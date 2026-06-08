<template lang="pug">
.content
  .tw-text-xs.tw-absolute.tw-top-2.tw-left-2.tw-font-bold.text-muted {{ $t('status') }}

  .tw-h-full.tw-w-full.tw-flex.tw-items-center.tw-justify-center(v-if="loading")
    v-progress-circular(indeterminate color="var(--cui-primary)" size="20")
  .tw-h-full.tw-w-full.tw-p-4.tw-relative.tw-flex.tw-flex-col.tw-items-center.tw-justify-center(v-else)
    .tw-flex.tw-items-center.tw-justify-center
      .tw-block
        v-icon.tw-mr-1(size="44" color="var(--cui-primary)") {{ icons['mdiCloudUpload'] }}
      .tw-mx-2
      .tw-block.tw-mx-auto
        .tw-block(v-if="updateAvailable")
          a.next-version-text(href="/settings/system" style="text-decoration: none; color: #ff5252;") {{ latestVersion }}
          .tw-text-sm {{ $t('update_available') }}
        .tw-block(v-else)
          .next-version-text {{ $t('up_to_date') }}
          .current-version-text {{ currentVersion }}

</template>

<script>
/* eslint-disable vue/require-default-prop */
import compareVersions from 'compare-versions';
import { mdiCloudUpload } from '@mdi/js';

import { getConfig } from '@/api/config.api';
import { getPackage } from '@/api/system.api';

const versionValue = (version) => version.value || version;
const versionChannel = (version) => versionValue(version).split('-')[1]?.split('.')[0] || 'latest';
const isRelatedVersion = (version, currentChannel) => {
  const channel = versionChannel(version);

  if (currentChannel === 'latest') {
    return channel === 'latest' || channel === 'windows';
  }

  return channel === currentChannel;
};
const sortVersionValues = (versions) =>
  versions
    .filter((version) => compareVersions.validate(version))
    .sort((a, b) => {
      if (compareVersions.compare(a, b, '>')) {
        return -1;
      }

      if (compareVersions.compare(a, b, '<')) {
        return 1;
      }

      return 0;
    });

export default {
  name: 'StatusWidget',

  props: {
    item: Object,
  },

  data: () => ({
    loading: true,

    icons: {
      mdiCloudUpload,
    },

    availableVersions: [],
    currentVersion: null,
    latestVersion: null,
    updateAvailable: false,
    npmPackageName: 'camera.ui',
  }),

  async mounted() {
    try {
      const config = await getConfig('?target=config');

      this.currentVersion = config.data.version;

      let currentDistTag = this.currentVersion.split('-')[1];

      if (!currentDistTag) {
        currentDistTag = 'latest';
      } else {
        currentDistTag = currentDistTag.split('.')[0];
      }

      const pkg = await getPackage();
      const versions = sortVersionValues(Object.keys(pkg.data.versions));
      const relatedVersions = versions.filter((version) => isRelatedVersion(version, currentDistTag));

      this.npmPackageName = pkg.data.name;
      this.latestVersion = relatedVersions[0] || this.currentVersion;
      this.updateAvailable = compareVersions.compare(this.latestVersion, this.currentVersion, '>');

      this.loading = false;
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }
  },

  beforeDestroy() {},

  methods: {},
};
</script>

<style scoped>
.content {
  width: 100%;
  height: 100%;
  background: var(--cui-bg-default);
  border-radius: 10px;
  -webkit-box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  border: 2px solid rgba(var(--cui-bg-card-border-rgb), 0.5);
}

.placeholder-card-text {
  aspect-ratio: 10 / 1;
  margin-top: 1rem;
  margin-bottom: 0;
}

.placeholder {
  background: var(--cui-text-hint);
  border-radius: 1rem;
  position: relative;
  overflow: hidden;
}

.next-version-text {
  font-size: 1.25rem;
  font-weight: bold;
  color: var(--cui-text-default);
}

.current-version-text {
  font-size: 0.875rem;
  font-weight: normal;
  color: var(--cui-text-hint);
}
</style>
