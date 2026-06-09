<template lang="pug">
.tw-h-full
  transition(name='overlay-fade' mode='out-in')
    .fullscreen-video-overlay(v-if="fullscreen")

  .video-card-container(ref="videoCardContainer" v-click-outside="{ handler: closeFullscreen, include: include }")

    v-card.video-card.card.tw-flex.tw-flex-col.fill-height.tw-relative(ref="videoPlayer" :class="(blank ? 'no-radius ' : ' ') + (fullscreen ? 'tw-h-full' : '')")

      // Video Title (top)
      .tw-z-10(v-if="title && titlePosition === 'top' && !fullscreen" @click="$router.push(`cameras/${camera.name}`)")
        v-card-title.video-card-top-title.tw-flex.tw-justify-between.tw-items-center
          span.font-weight-bold.text-truncate {{ camera.name }}
          v-badge(dot inline v-if="status" :color="loading || offline ? 'red' : 'green'")
        v-divider

      // Video Title (inner-top)
      .tw-z-10.tw-flex.tw-justify-center.tw-items-center.tw-w-full.tw-relative(v-if="title && titlePosition === 'inner-top' && !fullscreen")
        .video-card-inner-top-title(@click="$router.push(`cameras/${camera.name}`)") {{ camera.name }}

      // Video Container
      .tw-flex.tw-flex-col.tw-justify-center.tw-items-center.video-card-content
        
        // Loading Circle
        .loading-container.tw-flex.tw-justify-center.tw-items-center
          v-progress-circular(style="z-index: 2" indeterminate color="var(--cui-primary)" v-if="loading && !offline" :class="title && titlePosition === 'top' ? 'tw-mt-4' : ''")

        // Offline
        .offline.tw-flex.tw-flex-col.tw-justify-center.tw-items-center(v-if="!loading && offline")
          v-icon.tw-text-white(x-large v-if="!effectiveStream") {{ icons['mdiVideoOff'] }}
          v-btn.tw-text-white.tw-mt-3(v-if="effectiveStream" small color="var(--cui-primary)" @click="refreshStream(false)" fab)
            v-icon.tw-text-white {{ icons['mdiReload'] }}
          .tw-font-bold.tw-text-xs.tw-mt-2.text-muted {{ $t('offline') }}

        // Stream Canvas / Img Container
        .tw-w-full.tw-h-full(@click="!noLink && !blank ? $router.push(`cameras/${camera.name}`) : null" :class="!noLink && !blank ? 'tw-cursor-pointer' : ''")
          .tw-bg-black.tw-absolute.tw-inset-0(v-if="loading || false" style="border-radius: 10px;")
          canvas.main.tw-w-full.tw-h-full(v-if="effectiveStream" ref="streamBox" :width="canvasWidth" :height="canvasHeight")
          .tw-w-full.tw-h-full(v-else)
            .img-shadow-overlay
            v-img.main.tw-w-full.tw-h-full(:src="imgSource")

        // Timer
        .tw-z-10.tw-absolute.tw-bottom-0.tw-left-0.tw-right-0(v-if="refreshSnapshot || streamFallbackSnapshot" :style="`bottom: ${effectiveStream && !hideController ? '50px' : '10px'}`")
          .tw-flex.tw-justify-end
            .tw-flex.tw-justify-center.tw-items-center.video-card-timer.tw-text-center.tw-mr-3.tw-mb-3(ref="snapshotTimer") 0

        // Notifications
        .tw-z-10.tw-absolute.tw-left-0.tw-right-0.tw-cursor-pointer(@click="index = 0" v-if="!hideNotifications && notifications && !loading && !offline" :style="`bottom: ${effectiveStream && !hideController ? '50px' : '10px'}`")
          .tw-flex.tw-justify-center
            .tw-flex.tw-flex-col.tw-justify-center.tw-items-center.video-card-notifications.tw-text-center
              .tw-text-white {{ $t("last_notification") + ": " }}
              .tw-text-white.text-muted {{ camera.lastNotification.time }}

        // Video Controller
        .tw-z-10.tw-absolute.tw-bottom-0.tw-left-0.tw-right-0(v-if="effectiveStream && !hideController")
          .tw-flex.tw-content-end.tw-items-center.tw-justify-between.video-card-control(v-if="!loading && !offline")
            .tw-block.tw-p-2
              v-icon.tw-p-1.tw-cursor-pointer.controller-button(size="22" @click="handleStartStop") {{ !play ? icons['mdiPlay'] : icons['mdiPause'] }}
            .tw-ml-auto
            .tw-block.tw-p-2.tw-pr-0(v-if="!hideIndicatorReload")
              v-icon.tw-p-1.tw-cursor-pointer.controller-button(size="22" @click="refreshStream(false)") {{ icons['mdiRefresh'] }}
            .tw-block.tw-p-2.tw-pr-0(v-if="camera.settings.audio && !hideIndicatorAudio")
              v-icon.tw-p-1.tw-cursor-pointer.controller-button(size="22" @click="handleVolume") {{ audio ? icons['mdiVolumeHigh'] : icons['mdiVolumeOff'] }}
            .tw-block.tw-p-2.tw-pr-0(v-if="!hideIndicatorFullscreen")
              v-icon.tw-p-1.tw-cursor-pointer.controller-button(size="22" @click="toggleFullscreen") {{ !fullscreen ? icons['mdiArrowExpand'] : icons['mdiArrowCollapse'] }}
            .tw-pr-3

      // Video Title (bottom)
      .tw-z-10(v-if="title && titlePosition === 'bottom' && !fullscreen")
        v-card-title.video-card-bottom-title.tw-flex.tw-justify-between.tw-items-center.tw-absolute.tw-bottom-0.tw-left-0
          span.font-weight-bold.text-truncate.tw-text-white {{ camera.name }}

  LightBox(
    v-if="notifications && !hideNotifications"
    ref="lightboxBanner"
    :media="notImages"
    :showLightBox="false"
    :showThumbs="false"
    showCaption
    disableScroll
  )

</template>

<script>
/* eslint-disable vue/require-default-prop */
import LightBox from 'vue-it-bigger';
import 'vue-it-bigger/dist/vue-it-bigger.min.css';
import JSMpeg from '@seydx/jsmpeg/lib/index.js';
import JSMpegWritableSource from '@/common/jsmpeg-source.js';
import {
  mdiArrowExpand,
  mdiArrowCollapse,
  mdiPause,
  mdiPlay,
  mdiReload,
  mdiRefresh,
  mdiVideoOff,
  mdiVolumeHigh,
  mdiVolumeOff,
} from '@mdi/js';

import { getCameraSnapshot, getCameraStatus } from '@/api/cameras.api';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const STREAM_STALL_TIMEOUT = 15000;
const STREAM_WATCHDOG_INTERVAL = 5000;
const SNAPSHOT_REQUEST_CONCURRENCY = 2;
const CAMVIEW_SNAPSHOT_REFRESH_SECONDS = 8;

let activeSnapshotRequests = 0;
const pendingSnapshotRequests = [];

const drainSnapshotQueue = () => {
  while (activeSnapshotRequests < SNAPSHOT_REQUEST_CONCURRENCY && pendingSnapshotRequests.length > 0) {
    const { task, resolve, reject } = pendingSnapshotRequests.shift();

    activeSnapshotRequests++;

    Promise.resolve()
      .then(task)
      .then(resolve, reject)
      .finally(() => {
        activeSnapshotRequests--;
        drainSnapshotQueue();
      });
  }
};

const queueSnapshotRequest = (task) =>
  new Promise((resolve, reject) => {
    pendingSnapshotRequests.push({ task, resolve, reject });
    drainSnapshotQueue();
  });

export default {
  components: {
    LightBox,
  },
  props: {
    blank: Boolean,
    camera: Object,
    denseStream: Boolean,
    hideController: Boolean,
    hideNotifications: Boolean,
    hideIndicatorAudio: Boolean,
    hideIndicatorFullscreen: Boolean,
    hideIndicatorReload: Boolean,
    noLink: Boolean,
    notifications: Boolean,
    refreshSnapshot: Boolean,
    snapshot: Boolean,
    startDelay: {
      type: Number,
      default: 0,
    },
    status: Boolean,
    stream: Boolean,
    streamMode: {
      type: String,
      default: 'default',
    },
    title: Boolean,
    titlePosition: {
      type: String,
      default: 'top', //bottom, inner-top
    },
  },

  data: () => ({
    icons: {
      mdiArrowExpand,
      mdiArrowCollapse,
      mdiPause,
      mdiPlay,
      mdiReload,
      mdiRefresh,
      mdiVideoOff,
      mdiVolumeHigh,
      mdiVolumeOff,
    },
    images: [],
    imgSource: '',
    index: null,
    fullscreen: false,
    loading: true,
    audio: false,
    offline: false,
    destroyed: false,
    play: false,
    player: null,
    lastStreamDataAt: 0,
    snapshotTimerTimeout: null,
    snapshotTimeout: null,
    streamFallbackSnapshot: false,
    streamTimeout: null,
    streamWatchdogInterval: null,
    timeout: 60,
  }),

  computed: {
    effectiveStream() {
      return this.stream && !this.streamFallbackSnapshot;
    },
    canvasHeight() {
      return this.denseStream ? 360 : 720;
    },
    canvasWidth() {
      return this.denseStream ? 640 : 1280;
    },
    streamVideoBufferSize() {
      return this.denseStream ? 512 * 1024 : 1024 * 1024;
    },
  },

  async mounted() {
    //document.addEventListener('touchstart', this.onTouchStart, false);

    if (!this.hideController) {
      document.addEventListener('keydown', this.logKey);
    }

    if (this.camera.lastNotification) {
      const notification = this.camera.lastNotification;
      this.images = [
        {
          title: `${notification.camera} - ${notification.time}`,
          src: `/files/${notification.fileName}`,
          thumb:
            notification.recordType === 'Video'
              ? `/files/${notification.name}@2.jpeg`
              : `/files/${notification.fileName}`,
        },
      ];
    }

    this.timeout = this.camera.settings.streamTimeout || 60;

    if (this.startDelay > 0) {
      await timeout(this.startDelay);

      if (this.destroyed) {
        return;
      }
    }

    if (this.stream) {
      this.startStream();
    } else if (this.snapshot || this.refreshSnapshot) {
      this.startSnapshot();
    }
  },

  beforeDestroy() {
    this.destroy();
  },

  methods: {
    closeFullscreen() {
      this.fullscreen = false;

      const videoCardContainer = this.$refs.videoCardContainer;
      videoCardContainer?.removeAttribute('style');
      videoCardContainer?.classList.remove('fullscreen-video');

      window.removeEventListener('orientationchange', this.resizeFullscreenVideo);
      window.removeEventListener('resize', this.resizeFullscreenVideo);
    },
    handleStartStop() {
      if (this.player) {
        const paused = this.player.paused;

        if (paused) {
          this.player.play();
          this.play = true;
        } else {
          this.player.pause();
          this.play = false;
        }
      } else {
        this.play = false;
      }
    },
    handleVolume() {
      if (this.player) {
        const state = this.player.volume;

        if (state) {
          this.player.volume = 0;
          this.audio = false;
        } else {
          this.player.audioOut.unlock(() => {});

          this.player.volume = 1;
          this.audio = true;
        }
      } else {
        this.audio = false;
      }
    },
    logKey(event) {
      if ((event.key === 'Escape' || event.keyCode === 27) && this.fullscreen) {
        this.closeFullscreen();
      }
    },
    include() {
      return [this.$refs.videoPlayer.$el];
    },
    isMobile() {
      let isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.platform) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      return isMobile;
    },
    /*onUnlocked() {
      if (this.player) {
        this.player.volume = 1;
      }

      document.removeEventListener('touchstart', this.onTouchStart);
    },
    onTouchStart() {
      if (this.player) {
        this.player.audioOut.unlock(this.onUnlocked);
      }

      document.removeEventListener('touchstart', this.onTouchStart);
    },*/
    pauseStream() {
      if (this.player) {
        this.player.source.pause(true);
      }
    },
    refreshStream(rejoin) {
      if (!this.stream) {
        return;
      }

      if (this.streamTimeout) {
        clearTimeout(this.streamTimeout);
        this.streamTimeout = null;
      }

      if (rejoin === true) {
        this.$socket.client.emit('rejoin_stream', this.streamSocketPayload());
      } else {
        this.offline = false;
        this.loading = true;
        this.lastStreamDataAt = Date.now();

        this.pauseStream(true);

        this.$socket.client.emit('refresh_stream', this.streamSocketPayload());

        this.streamTimeout = setTimeout(() => {
          if (this.loading) {
            this.loading = false;
            this.offline = true;

            this.stopStream();
            this.$toast.warning(`${this.camera.name}: ${this.$t('timeout')}`);
          }
        }, this.timeout * 1000);
      }
    },
    resizeFullscreenVideo() {
      const videoCardContainer = this.$refs.videoCardContainer;

      let videoWidth = this.windowWidth() - 64 <= 1280 ? this.windowWidth() - 64 : 1280;
      let videoHeight = Math.round(videoWidth / (16 / 9)) + (this.stream && !this.hideController ? 40 : 0);

      videoHeight = videoHeight <= this.windowHeight() - 64 ? videoHeight : this.windowHeight() - 64;

      videoCardContainer?.classList.add('fullscreen-video');
      videoCardContainer?.setAttribute('style', `height: ${videoHeight}px !important;`);
    },
    snapshotTimer() {
      let timerIndicator = this.$refs.snapshotTimer;

      if (timerIndicator) {
        if (this.snapshotTimerTimeout) {
          clearInterval(this.snapshotTimerTimeout);
          this.snapshotTimerTimeout = null;
        }

        this.timerCounter = 0;

        this.snapshotTimerTimeout = setInterval(() => {
          this.timerCounter++;
          timerIndicator.textContent = this.timerCounter + 's';
        }, 1000);
      }
    },
    snapshotRefreshSeconds() {
      const configured = Number(this.camera.refreshTimer);

      if (this.streamMode !== 'camview') {
        return Number.isFinite(configured) && configured >= 1 ? configured : 60;
      }

      if (!Number.isFinite(configured) || configured < 1) {
        return CAMVIEW_SNAPSHOT_REFRESH_SECONDS;
      }

      return Math.max(5, Math.min(configured, CAMVIEW_SNAPSHOT_REFRESH_SECONDS));
    },
    async startSnapshot() {
      const hasImage = Boolean(this.imgSource);
      this.loading = !hasImage;

      if (this.snapshotTimerTimeout) {
        clearInterval(this.snapshotTimerTimeout);
        this.snapshotTimerTimeout = null;
      }

      try {
        const checkStatus = this.streamMode !== 'camview' || !hasImage;
        const status = checkStatus
          ? await getCameraStatus(this.camera.name, this.camera.settings.pingTimeout)
          : { data: { status: 'ONLINE' } };

        if (this.destroyed) {
          return;
        }

        if (checkStatus) {
          this.$emit('cameraStatus', {
            name: this.camera.name,
            status: status.data.status,
          });
        }

        if (status.data.status === 'ONLINE') {
          const snapshotParameters = this.streamMode === 'camview' ? '?buffer=true&fromSubSource=true' : '?buffer=true';
          const snapshot =
            this.streamMode === 'camview'
              ? await queueSnapshotRequest(() => getCameraSnapshot(this.camera.name, snapshotParameters))
              : await getCameraSnapshot(this.camera.name, snapshotParameters);

          if (this.destroyed) {
            return;
          }

          this.loading = false;

          if (!snapshot.data || (snapshot.data && snapshot.data === '')) {
            this.offline = !this.imgSource;
          } else {
            this.offline = false;
            this.imgSource = `data:image/png;base64,${snapshot.data}`;
          }
        } else {
          this.loading = false;
          this.offline = !this.imgSource;

          if (!this.streamFallbackSnapshot) {
            this.$toast.error(`${this.camera.name}: ${this.$t('offline')}`);
          }
        }
      } catch (err) {
        console.log(this.camera.name, err);

        if (!this.imgSource || !this.streamFallbackSnapshot) {
          this.$toast.error(`${this.camera.name}: ${err.message}`);
        }

        this.loading = false;
        this.offline = !this.imgSource;
      }

      if ((this.refreshSnapshot || this.streamFallbackSnapshot) && !this.destroyed) {
        await timeout(10);

        this.snapshotTimer();

        if (this.snapshotTimeout) {
          clearTimeout(this.snapshotTimeout);
          this.snapshotTimeout = null;
        }

        this.snapshotTimeout = setTimeout(async () => {
          this.startSnapshot();
        }, this.snapshotRefreshSeconds() * 1000);
      }
    },
    async startStream() {
      try {
        this.streamFallbackSnapshot = false;

        const status = await getCameraStatus(this.camera.name, this.camera.settings.pingTimeout);

        if (status.data.status === 'ONLINE') {
          this.offline = false;

          this.player = new JSMpeg.Player(null, {
            source: JSMpegWritableSource,
            canvas: this.$refs.streamBox,
            audio: true,
            //disableWebAssembly: true,
            pauseWhenHidden: false,
            videoBufferSize: this.streamVideoBufferSize,
            onSourcePaused: () => {
              this.play = false;
            },
            onSourceEstablished: () => {
              this.loading = false;
              this.offline = false;
              this.lastStreamDataAt = Date.now();

              this.play = true;
              this.player.volume = 0;
              this.audio = !this.isMobile() && this.player.volume;

              if (this.streamTimeout) {
                clearTimeout(this.streamTimeout);
                this.streamTimeout = null;
              }
            },
          });

          this.player.volume = 0;
          this.player.name = this.camera.name;
          this.audio = !this.isMobile() && this.player.volume;

          this.lastStreamDataAt = Date.now();
          this.$socket.client.emit('join_stream', this.streamSocketPayload());

          this.$socket.client.on(this.camera.name, this.writeStream);
          this.startStreamWatchdog();

          this.streamTimeout = setTimeout(() => {
            if (this.loading) {
              this.handleStreamFailure(`${this.camera.name}: ${this.$t('timeout')}`);
            }
          }, this.timeout * 1000);
        } else {
          this.handleStreamFailure(`${this.camera.name}: ${this.$t('offline')}`, 'error');
        }
      } catch (err) {
        console.log(this.camera.name, err);
        this.handleStreamFailure(`${this.camera.name}: ${err.message}`, 'error');
      }
    },
    destroy() {
      this.destroyed = true;
      this.stopStream();
      this.stopSnapshot();

      this.$socket.client.off(this.camera.name, this.writeStream);
      document.removeEventListener('keydown', this.logKey);
      document.removeEventListener('touchstart', this.onTouchStart);
      window.removeEventListener('orientationchange', this.resizeFullscreenVideo);
      window.removeEventListener('resize', this.resizeFullscreenVideo);
    },
    stopSnapshot() {
      if (this.snapshotTimeout) {
        clearTimeout(this.snapshotTimeout);
        this.snapshotTimeout = null;
      }

      if (this.snapshotTimerTimeout) {
        clearTimeout(this.snapshotTimerTimeout);
        this.snapshotTimerTimeout = null;
      }
    },
    stopStream() {
      if (this.player) {
        this.player.destroy();
        this.player = null;
      }

      if (this.streamTimeout) {
        clearTimeout(this.streamTimeout);
        this.streamTimeout = null;
      }

      this.stopStreamWatchdog();

      this.$socket.client.emit('leave_stream', this.streamSocketPayload());
    },
    handleStreamFailure(message, level = 'warning') {
      this.stopStream();

      if (this.streamMode === 'camview') {
        this.streamFallbackSnapshot = true;
        this.loading = true;
        this.offline = false;

        if (message) {
          this.$toast[level] ? this.$toast[level](message) : this.$toast.warning(message);
        }

        this.startSnapshot();
        return;
      }

      this.loading = false;
      this.offline = true;

      if (message) {
        this.$toast[level] ? this.$toast[level](message) : this.$toast.warning(message);
      }
    },
    startStreamWatchdog() {
      this.stopStreamWatchdog();

      this.streamWatchdogInterval = setInterval(() => {
        if (!this.player || this.loading || this.offline || !this.lastStreamDataAt) {
          return;
        }

        if (Date.now() - this.lastStreamDataAt >= STREAM_STALL_TIMEOUT) {
          this.refreshStream(false);
        }
      }, STREAM_WATCHDOG_INTERVAL);
    },
    stopStreamWatchdog() {
      if (this.streamWatchdogInterval) {
        clearInterval(this.streamWatchdogInterval);
        this.streamWatchdogInterval = null;
      }
    },
    streamSocketPayload() {
      return {
        feed: this.camera.name,
        dense: this.denseStream,
        mode: this.streamMode,
      };
    },
    toggleFullscreen() {
      this.fullscreen = !this.fullscreen;

      if (this.fullscreen) {
        setTimeout(() => this.resizeFullscreenVideo(), 1);

        window.addEventListener('orientationchange', this.resizeFullscreenVideo);
        window.addEventListener('resize', this.resizeFullscreenVideo);
      } else {
        this.closeFullscreen();
      }
    },
    windowHeight() {
      return Math.max(document.documentElement.clientHeight, window.innerHeight);
    },
    windowWidth() {
      return Math.max(document.documentElement.clientWidth, window.innerWidth);
    },
    writeStream(buffer) {
      if (this.player) {
        this.lastStreamDataAt = Date.now();
        this.player.source.write(buffer);
      }
    },
  },
};
</script>

<style scoped>
.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition-duration: 0.1s;
  transition-property: all;
  transition-timing-function: ease-in-out;
  transition-delay: 0;
}

.overlay-fade-enter,
.overlay-fade-leave-active {
  opacity: 0;
}

.video-card-container {
  height: 100%;
}

.video-card {
  color: var(--cui-text-default) !important;
  background: #000 !important;
  border-radius: 10px !important;
  overflow: hidden !important;
  height: 100%;
  width: 100%;
}

.no-radius {
  border-radius: 0 !important;
}

.video-card-top-title {
  padding: 0;
  margin: 0;
  font-size: 13px;
  background: var(--cui-bg-card);
  height: 38px;
  padding: 4px;
  padding-left: 10px;
  padding-right: 10px;
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
}

.video-card-inner-top-title {
  position: absolute;
  top: 1rem;
  padding: 10px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  font-size: 0.8rem;
  color: #fff;
  cursor: pointer;
  font-weight: 500;
}

.video-card-bottom-title {
  padding: 0;
  margin: 0;
  font-size: 13px;
  height: 38px;
  padding: 4px;
  padding-left: 10px;
  padding-right: 10px;
}

.video-card-content {
  width: 100%;
  height: 100%;
}

.video-card-control {
  width: 100%;
  height: 40px;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
}

.video-card-notifications {
  background: rgba(0, 0, 0, 0.5);
  border-radius: 10px;
  font-size: 10px;
  padding: 10px;
}

.video-card-timer {
  width: 30px;
  height: 30px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 20px;
  font-size: 10px;
}

.controller-button {
  color: #fff;
  transition: 0.3s all;
}

.controller-button:hover {
  color: rgb(161, 161, 161);
}

.fullscreen-video-overlay {
  background: rgba(0, 0, 0, 0.99);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99990;
}

.fullscreen-video {
  position: fixed;
  z-index: 99999;
  top: 50%;
  left: 50%;
  width: 100%;
  padding-left: 32px;
  padding-right: 32px;
  transform: translate(-50%, -50%);
  max-width: 1280px;
  max-height: 720px;
}

.fullscreen-video-player {
  width: 100% !important;
  max-width: 1280px !important;
  height: 100% !important;
  max-height: 720px !important;
}

.offline {
  position: absolute;
}

.img-shadow-overlay {
  background: rgb(0, 0, 0);
  background: -moz-linear-gradient(0deg, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0) 100%);
  background: -webkit-linear-gradient(0deg, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0) 100%);
  background: linear-gradient(0deg, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0) 100%);
  filter: progid:DXImageTransform.Microsoft.gradient(startColorstr="#000000",endColorstr="#000000",GradientType=1);
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  border: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.loading-container {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 100%;
}
</style>
