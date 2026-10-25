'use-strict';

import isEqual from 'lodash/isEqual.js';
import { spawn } from '../../../common/child-processes.js';

import * as cameraUtils from '../utils/camera.utils.js';
import { Mp4BoxReader, getCodecString, getDefaultSampleFlags, isKeyframeFragment } from '../utils/fmp4.utils.js';

import ConfigService from '../../../services/config/config.service.js';
import LoggerService from '../../../services/logger/logger.service.js';

import Socket from '../../../api/socket.js';

const { log } = LoggerService;
const FRAGMENT_DURATION_US = 100000;
const GOP_CACHE_MAX_BYTES = 16 * 1024 * 1024;
const STALL_TIMEOUT = 20000;
const RESTART_WINDOW = 60 * 1000;
const RESTART_LIMIT = 3;

export const LIVE_VARIANTS = ['main', 'sub'];

export const liveRoom = (variant, cameraName) => `live/${variant}/${cameraName}`;

/**
 * Passes the camera video through as fragmented MP4 (no transcoding) for native playback in the browser (MSE).
 * One ffmpeg process per camera and variant is shared by all viewers.
 */
export default class LiveService {
  #camera;
  #prebufferService;
  #mediaService;
  #variant;

  #process = null;
  #reader = null;
  #init = null;
  #codec = null;
  #defaultSampleFlags = 0;
  #moof = null;
  #gopCache = [];
  #gopCacheBytes = 0;
  #lastDataAt = 0;
  #watchdog = null;
  #restartTimer = null;
  #restartAttempts = 0;
  #lastRestartAttemptAt = 0;

  destroyed = false;

  constructor(camera, prebufferService, mediaService, variant = 'main') {
    this.#camera = camera;
    this.#prebufferService = prebufferService;
    this.#mediaService = mediaService;
    this.#variant = variant;

    this.cameraName = camera.name;
  }

  get room() {
    return liveRoom(this.#variant, this.cameraName);
  }

  reconfigure(camera) {
    const oldVideoConfig = this.#camera.videoConfig;

    this.#camera = camera;
    this.cameraName = camera.name;

    if (!isEqual(oldVideoConfig, camera.videoConfig) && this.#process) {
      log.info(`Live (${this.#variant}): Video configuration changed! Restarting...`, this.cameraName);
      this.restart();
    }
  }

  /**
   * Sends the init segment and the frames since the last keyframe, so a new viewer gets a picture right away
   */
  attach(socket) {
    if (!this.#init) {
      return;
    }

    socket.emit('live_init', this.#initPayload());

    for (const segment of this.#gopCache) {
      socket.emit(this.room, segment);
    }
  }

  async #ffmpegInput() {
    const videoConfig = cameraUtils.generateVideoConfig(this.#camera.videoConfig);
    const hasSubSource = videoConfig.subSource && String(videoConfig.subSource) !== String(videoConfig.source);
    const useSubSource = this.#variant === 'sub' && hasSubSource;

    if (!useSubSource && this.#camera.prebuffering && this.#prebufferService) {
      try {
        return {
          input: await this.#prebufferService.getVideo({ container: 'mpegts' }),
          map: '0:v:0',
        };
      } catch {
        // fall back to the camera source
      }
    }

    const input = cameraUtils
      .generateInputSource(videoConfig, useSubSource ? videoConfig.subSource : false)
      .split(/\s+/);

    return {
      input: cameraUtils.checkDeprecatedFFmpegArguments(this.#mediaService.codecs.ffmpegVersion, input),
      map: !useSubSource && videoConfig.mapvideo ? videoConfig.mapvideo : '0:v:0',
    };
  }

  async start() {
    if (this.#process || this.destroyed) {
      return;
    }

    clearTimeout(this.#restartTimer);
    this.#restartTimer = null;

    const { input, map } = await this.#ffmpegInput();

    // another start() could have won while waiting for the prebuffer
    if (this.#process || this.destroyed) {
      return;
    }

    const ffmpegArguments = [
      '-hide_banner',
      '-loglevel',
      'error',
      ...input,
      '-map',
      map,
      '-c:v',
      'copy',
      '-an',
      '-f',
      'mp4',
      '-movflags',
      'empty_moov+default_base_moof+frag_keyframe',
      '-frag_duration',
      `${FRAGMENT_DURATION_US}`,
      '-',
    ].filter((argument) => argument !== '');

    log.debug(
      `Live (${this.#variant}) command: ${ConfigService.ui.options.videoProcessor} ${ffmpegArguments.join(' ')}`,
      this.cameraName
    );

    this.#resetState();

    const cp = spawn(ConfigService.ui.options.videoProcessor, ffmpegArguments, { env: process.env });
    let errors = [];

    this.#process = cp;
    this.#lastDataAt = Date.now();
    this.#startWatchdog();

    cp.stdout.on('data', (chunk) => {
      if (this.#process !== cp) {
        return;
      }

      try {
        for (const box of this.#reader.push(chunk)) {
          this.#handleBox(box);
        }
      } catch (error) {
        log.warn(`Live (${this.#variant}): ${error.message}`, this.cameraName, 'streams');
        cp.kill('SIGKILL');
      }
    });

    cp.stderr.on('data', (data) => {
      errors = errors.slice(-5);
      errors.push(data.toString().replace(/(\r\n|\n|\r)/gm, ' '));
    });

    cp.on('error', (error) => {
      errors.unshift(`Can not start live process: ${error.message}`);
    });

    cp.on('close', (code, signal) => {
      if (this.#process !== cp) {
        return;
      }

      this.#process = null;
      this.#stopWatchdog();

      const failed = code !== 0 && signal !== 'SIGKILL';

      if (failed) {
        errors.unshift(`Live (${this.#variant}) exited with error! (${code ?? signal})`);
        log.error(errors.join(' - '), this.cameraName, 'streams');
      } else {
        log.debug(`Live (${this.#variant}) exit (expected)`, this.cameraName);
      }

      if (!this.#init && failed) {
        Socket.io?.to(this.room).emit('live_error', {
          feed: this.cameraName,
          variant: this.#variant,
          message: errors.join(' - '),
        });
      }

      this.#resetState();

      if (!this.destroyed && Socket.hasLiveClients(this.#variant, this.cameraName)) {
        this.#scheduleRestart();
      }
    });
  }

  stop() {
    clearTimeout(this.#restartTimer);
    this.#restartTimer = null;
    this.#stopWatchdog();

    if (this.#process) {
      log.debug(`Stopping live (${this.#variant})..`, this.cameraName);

      const cp = this.#process;
      this.#process = null;
      this.#resetState();
      cp.kill('SIGKILL');
    }
  }

  restart() {
    if (this.destroyed) {
      return;
    }

    this.#restartAttempts = 0;
    this.stop();
    this.start();
  }

  destroy() {
    this.destroyed = true;
    this.stop();
  }

  #handleBox(box) {
    this.#lastDataAt = Date.now();

    switch (box.type) {
      case 'ftyp':
        this.#init = box.data;
        break;
      case 'moov':
        this.#init = Buffer.concat([this.#init || Buffer.alloc(0), box.data]);
        this.#codec = getCodecString(box.data);
        this.#defaultSampleFlags = getDefaultSampleFlags(box.data);
        Socket.io?.to(this.room).emit('live_init', this.#initPayload());
        break;
      case 'moof':
        this.#moof = box.data;
        break;
      case 'mdat': {
        if (!this.#moof || !this.#init) {
          return;
        }

        const keyframe = isKeyframeFragment(this.#moof, this.#defaultSampleFlags);
        const segment = Buffer.concat([this.#moof, box.data]);

        this.#moof = null;
        this.#restartAttempts = 0;

        if (keyframe || this.#gopCacheBytes + segment.length > GOP_CACHE_MAX_BYTES) {
          this.#gopCache = [];
          this.#gopCacheBytes = 0;
        }

        // without a keyframe at the start the cache is useless for new viewers
        if (keyframe || this.#gopCache.length > 0) {
          this.#gopCache.push(segment);
          this.#gopCacheBytes += segment.length;
        }

        Socket.io?.to(this.room).emit(this.room, segment);
        break;
      }
    }
  }

  #initPayload() {
    return {
      feed: this.cameraName,
      variant: this.#variant,
      codec: this.#codec,
      init: this.#init,
    };
  }

  #resetState() {
    this.#reader = new Mp4BoxReader();
    this.#init = null;
    this.#codec = null;
    this.#defaultSampleFlags = 0;
    this.#moof = null;
    this.#gopCache = [];
    this.#gopCacheBytes = 0;
  }

  #scheduleRestart() {
    const now = Date.now();

    if (now - this.#lastRestartAttemptAt > RESTART_WINDOW) {
      this.#restartAttempts = 0;
    }

    this.#lastRestartAttemptAt = now;
    this.#restartAttempts++;

    if (this.#restartAttempts > RESTART_LIMIT) {
      log.warn(`Live (${this.#variant}) exited repeatedly. Automatic restart paused.`, this.cameraName, 'streams');
      return;
    }

    log.debug(`Live (${this.#variant}) exited while clients are connected. Restarting...`, this.cameraName);
    this.#restartTimer = setTimeout(() => this.start(), 2000 * this.#restartAttempts);
  }

  #startWatchdog() {
    this.#stopWatchdog();

    this.#watchdog = setInterval(() => {
      if (this.#process && Date.now() - this.#lastDataAt > STALL_TIMEOUT) {
        log.warn(`Live (${this.#variant}) stalled. Restarting...`, this.cameraName, 'streams');
        this.#process.kill('SIGKILL');
      }
    }, 5000);
  }

  #stopWatchdog() {
    clearInterval(this.#watchdog);
    this.#watchdog = null;
  }
}
