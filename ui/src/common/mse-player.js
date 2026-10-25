// Plays fragmented MP4 segments (passed through from the camera without transcoding) in a <video> element

const MAX_LATENCY = 2;
const CATCH_UP_LATENCY = 0.8;
const LIVE_EDGE_OFFSET = 0.2;
const KEEP_BUFFER_SECONDS = 10;
const MAX_QUEUED_BYTES = 8 * 1024 * 1024;

export const isMseSupported = () => typeof window !== 'undefined' && Boolean(window.MediaSource);

export const isCodecSupported = (codec) =>
  isMseSupported() && Boolean(codec) && window.MediaSource.isTypeSupported(`video/mp4; codecs="${codec}"`);

export default class MsePlayer {
  constructor(video, { onError, onPlaying, onResync, onResume } = {}) {
    this.video = video;
    this.onError = onError || (() => {});
    this.onPlaying = onPlaying || (() => {});
    this.onResync = onResync || (() => {});
    this.onResume = onResume || (() => {});

    this.mediaSource = null;
    this.sourceBuffer = null;
    this.objectUrl = null;
    this.queue = [];
    this.queuedBytes = 0;
    this.destroyed = false;

    this.handlePlaying = () => this.onPlaying();
    this.handleVideoError = () => {
      if (this.mediaSource) {
        this.onError(new Error(`Video error: ${this.video.error?.message || this.video.error?.code}`));
      }
    };

    this.video.addEventListener('playing', this.handlePlaying);
    this.video.addEventListener('error', this.handleVideoError);
  }

  init(codec, initSegment) {
    this.reset();

    const mediaSource = new window.MediaSource();

    this.mediaSource = mediaSource;
    this.objectUrl = URL.createObjectURL(mediaSource);
    this.video.src = this.objectUrl;

    mediaSource.addEventListener(
      'sourceopen',
      () => {
        if (this.mediaSource !== mediaSource) {
          return;
        }

        URL.revokeObjectURL(this.objectUrl);
        this.objectUrl = null;

        try {
          this.sourceBuffer = mediaSource.addSourceBuffer(`video/mp4; codecs="${codec}"`);
          this.sourceBuffer.mode = 'segments';
          this.sourceBuffer.addEventListener('updateend', () => this.onUpdateEnd());
          this.sourceBuffer.addEventListener('error', () => this.onError(new Error('SourceBuffer error')));

          this.queue.unshift(new Uint8Array(initSegment));
          this.pump();
        } catch (error) {
          this.onError(error);
        }
      },
      { once: true }
    );
  }

  append(segment) {
    // paused by the user: nothing to show, resume starts over at the live edge
    if (this.destroyed || !this.mediaSource || this.userPaused) {
      return;
    }

    const data = new Uint8Array(segment);

    this.queue.push(data);
    this.queuedBytes += data.byteLength;

    // the decoder can't keep up (or the tab slept), restart from the server's last keyframe
    if (this.queuedBytes > MAX_QUEUED_BYTES) {
      this.queue = [];
      this.queuedBytes = 0;
      this.onResync();
      return;
    }

    this.pump();
  }

  pump() {
    const sourceBuffer = this.sourceBuffer;

    if (!sourceBuffer || sourceBuffer.updating || this.queue.length === 0 || this.mediaSource.readyState !== 'open') {
      return;
    }

    const chunks = this.queue;
    this.queue = [];
    this.queuedBytes = 0;

    let data = chunks[0];

    if (chunks.length > 1) {
      data = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.byteLength, 0));

      let offset = 0;

      for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.byteLength;
      }
    }

    try {
      sourceBuffer.appendBuffer(data);
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        this.trim(true);
        return;
      }

      this.onError(error);
    }
  }

  onUpdateEnd() {
    if (this.destroyed) {
      return;
    }

    this.followLiveEdge();

    if (!this.trim()) {
      this.pump();
    }
  }

  followLiveEdge() {
    const { buffered } = this.video;

    if (buffered.length === 0) {
      return;
    }

    const start = buffered.start(buffered.length - 1);
    const end = buffered.end(buffered.length - 1);
    const latency = end - this.video.currentTime;

    if (this.video.currentTime < start || latency > MAX_LATENCY) {
      this.video.currentTime = Math.max(start, end - LIVE_EDGE_OFFSET);
    }

    this.video.playbackRate = latency > CATCH_UP_LATENCY && latency <= MAX_LATENCY ? 1.1 : 1;

    if (this.video.paused && !this.userPaused) {
      this.video.play().catch(() => {});
    }
  }

  // removes old data so the buffer doesn't grow forever, returns true when a remove was started
  trim(force = false) {
    const sourceBuffer = this.sourceBuffer;
    const { buffered } = this.video;

    if (!sourceBuffer || sourceBuffer.updating || buffered.length === 0) {
      return false;
    }

    const start = buffered.start(0);
    const keepFrom =
      Math.min(this.video.currentTime, buffered.end(buffered.length - 1)) - KEEP_BUFFER_SECONDS / (force ? 2 : 1);

    if (keepFrom - start < (force ? 0.5 : KEEP_BUFFER_SECONDS)) {
      return false;
    }

    try {
      sourceBuffer.remove(start, keepFrom);
      return true;
    } catch {
      return false;
    }
  }

  pause() {
    this.userPaused = true;
    this.video.pause();
  }

  play() {
    this.userPaused = false;
    this.onResume();
  }

  get paused() {
    return this.video.paused;
  }

  reset() {
    this.queue = [];
    this.queuedBytes = 0;
    this.sourceBuffer = null;

    if (this.mediaSource?.readyState === 'open') {
      try {
        this.mediaSource.endOfStream();
      } catch {
        // ignore
      }
    }

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }

    this.mediaSource = null;
    this.video.removeAttribute('src');
    this.video.load();
  }

  destroy() {
    this.destroyed = true;
    this.video.removeEventListener('playing', this.handlePlaying);
    this.video.removeEventListener('error', this.handleVideoError);
    this.reset();
  }
}
