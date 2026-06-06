'use-strict';

import { spawn } from 'child_process';

import ConfigService from '../../../services/config/config.service.js';

const PROBE_TIMEOUT = 7000;
const THUMBNAIL_TIMEOUT = 7000;
const FFMPEG_TIMEOUT = '4000000';
const DEFAULT_RTSP_PORT = '554';
const COMMON_PATHS = [
  '/ch0_0.264',
  '/ch0_1.264',
  '/onvif1',
  '/onvif2',
  '/live/ch00_0',
  '/live/ch00_1',
  '/stream1',
  '/stream2',
  '/video1',
  '/video2',
  '/h264Preview_01_main',
  '/h264Preview_01_sub',
  '/cam/realmonitor?channel=1&subtype=0',
  '/cam/realmonitor?channel=1&subtype=1',
  '/Streaming/Channels/101',
  '/Streaming/Channels/102',
  '/h264/ch1/main/av_stream',
  '/h264/ch1/sub/av_stream',
];

const redactUri = (uri) =>
  uri
    .replace(/(rtsp:\/\/[^:/@]+:)[^@]+@/i, '$1***@')
    .replace(/(password=)[^_&?\s/]+/gi, '$1***')
    .replace(/(pwd=)[^_&?\s/]+/gi, '$1***')
    .replace(/(pass=)[^_&?\s/]+/gi, '$1***');

const cleanError = (message) => redactUri(`${message || ''}`.replace(/\s+/g, ' ').trim()).slice(0, 260);

const encodeAuthPart = (value) => encodeURIComponent(value || '').replace(/%3A/gi, ':');

const buildRtspUri = ({ host, port = DEFAULT_RTSP_PORT, path = '/', username = '', password = '', includeColon = true }) => {
  const safePath = path.startsWith('/') ? path : `/${path}`;
  const auth =
    username || password
      ? `${encodeAuthPart(username)}${includeColon ? `:${encodeAuthPart(password)}` : ''}@`
      : '';

  return `rtsp://${auth}${host}:${port}${safePath}`;
};

const uriParts = (uri, fallbackIp) => {
  try {
    const url = new URL(uri);

    return {
      host: url.hostname || fallbackIp,
      port: url.port || DEFAULT_RTSP_PORT,
      path: `${url.pathname || '/'}${url.search || ''}`,
    };
  } catch (error) {
    return {
      host: fallbackIp,
      port: DEFAULT_RTSP_PORT,
      path: '/',
    };
  }
};

const addCandidate = (candidates, uri) => {
  if (uri && !candidates.includes(uri)) {
    candidates.push(uri);
  }
};

export const candidatesFor = ({ ip, uri, username = '', password = '' }) => {
  const candidates = [];
  const parts = uriParts(uri, ip);
  const host = parts.host || ip;
  const port = parts.port || DEFAULT_RTSP_PORT;
  const originalPath = parts.path;

  if (username || password) {
    addCandidate(candidates, buildRtspUri({ host, port, path: originalPath, username, password }));

    if (username && !password) {
      addCandidate(candidates, buildRtspUri({ host, port, path: originalPath, username, password, includeColon: false }));
    }
  }

  addCandidate(candidates, uri);

  for (const path of COMMON_PATHS) {
    if (username || password) {
      addCandidate(candidates, buildRtspUri({ host, port, path, username, password }));

      if (username && !password) {
        addCandidate(candidates, buildRtspUri({ host, port, path, username, password, includeColon: false }));
      }
    }

    addCandidate(candidates, buildRtspUri({ host, port, path }));
  }

  return candidates.slice(0, 36);
};

export const probeUri = (uri) =>
  new Promise((resolve) => {
    const videoProcessor = ConfigService.ui?.options?.videoProcessor || 'ffmpeg';
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-rtsp_transport',
      'tcp',
      '-timeout',
      FFMPEG_TIMEOUT,
      '-i',
      uri,
      '-t',
      '1',
      '-an',
      '-f',
      'null',
      '-',
    ];
    let stderr = '';
    let settled = false;

    const finish = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve({
        ...result,
        uri,
        displayUri: redactUri(uri),
      });
    };

    const process_ = spawn(videoProcessor, args, { env: process.env });
    const timeout = setTimeout(() => {
      process_.kill('SIGKILL');
      finish({
        ok: false,
        error: 'RTSP probe timed out',
      });
    }, PROBE_TIMEOUT);

    process_.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process_.on('error', (error) => {
      clearTimeout(timeout);
      finish({
        ok: false,
        error: cleanError(error.message),
      });
    });

    process_.on('exit', (code) => {
      clearTimeout(timeout);
      finish({
        ok: code === 0,
        error: code === 0 ? '' : cleanError(stderr),
      });
    });
  });

export const captureThumbnail = (uri) =>
  new Promise((resolve) => {
    const videoProcessor = ConfigService.ui?.options?.videoProcessor || 'ffmpeg';
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-rtsp_transport',
      'tcp',
      '-timeout',
      FFMPEG_TIMEOUT,
      '-i',
      uri,
      '-frames:v',
      '1',
      '-an',
      '-vf',
      'scale=160:-1',
      '-q:v',
      '5',
      '-f',
      'image2pipe',
      '-vcodec',
      'mjpeg',
      '-',
    ];
    let stderr = '';
    let imageBuffer = Buffer.alloc(0);
    let settled = false;

    const finish = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(result);
    };

    const process_ = spawn(videoProcessor, args, { env: process.env });
    const timeout = setTimeout(() => {
      process_.kill('SIGKILL');
      finish({
        ok: false,
        error: 'RTSP thumbnail timed out',
      });
    }, THUMBNAIL_TIMEOUT);

    process_.stdout.on('data', (data) => {
      imageBuffer = Buffer.concat([imageBuffer, data]);
    });

    process_.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process_.on('error', (error) => {
      clearTimeout(timeout);
      finish({
        ok: false,
        error: cleanError(error.message),
      });
    });

    process_.on('exit', (code) => {
      clearTimeout(timeout);

      if (code === 0 && imageBuffer.length > 0) {
        finish({
          ok: true,
          thumbnail: `data:image/jpeg;base64,${imageBuffer.toString('base64')}`,
        });
      } else {
        finish({
          ok: false,
          error: cleanError(stderr) || 'RTSP thumbnail is empty',
        });
      }
    });
  });

export const test = async ({ ip, uri, username = '', password = '' }) => {
  const candidates = candidatesFor({ ip, uri, username, password });
  const failures = [];

  for (const candidate of candidates) {
    const result = await probeUri(candidate);

    if (result.ok) {
      const thumbnailResult = await captureThumbnail(result.uri);

      return {
        ok: true,
        uri: result.uri,
        displayUri: result.displayUri,
        source: `-i ${result.uri}`,
        tested: failures.length + 1,
        thumbnail: thumbnailResult.ok ? thumbnailResult.thumbnail : '',
        thumbnailError: thumbnailResult.ok ? '' : thumbnailResult.error,
        failures,
      };
    }

    failures.push({
      uri: result.displayUri,
      error: result.error,
    });
  }

  return {
    ok: false,
    tested: failures.length,
    failures: failures.slice(0, 8),
  };
};
