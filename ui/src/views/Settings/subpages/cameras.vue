<template lang="pug">
.tw-w-full
  v-progress-linear.loader(:active="loadingProgress" :indeterminate="loadingProgress" fixed top color="var(--cui-primary)" style="z-index: 3;")

  .tw-mb-7.tw-mt-5(v-if="!loading" ref="innerContainer")
    label.form-input-label {{ $t('selected_camera') }}
    v-select(v-model="camera" :items="cameras" :no-data-text="$t('no_data_available')" item-text="name" prepend-inner-icon="mdi-cctv" append-outer-icon="mdi-close-thick" background-color="var(--cui-bg-card)" return-object solo)
      template(v-slot:prepend-inner)
        v-icon.text-muted {{ icons['mdiCctv'] }}
      template(v-slot:append-outer)
        v-dialog(v-model="removeCameraDialog" width="500" scrollable)
          template(v-slot:activator='{ on, attrs }')
            v-btn(icon v-bind='attrs' v-on='camera && camera.name ? on : null' style="margin-top: -6px;")
              v-icon.tw-cursor-pointer(color="error") {{ icons['mdiCloseThick'] }}
          v-card(v-if="camera && camera.name")
            v-card-title {{ $t('remove_camera') }}
            v-divider
            v-card-text.tw-p-7.text-default.tw-text-center {{ moduleName === 'homebridge-camera-ui' ? $t('remove_camera_confirm_text_homebridge').replace('@', camera.name) : $t('remove_camera_confirm_text').replace('@', camera.name) }}
            v-divider
            v-card-actions.tw-flex.tw-justify-end
              v-btn.text-default(text @click='removeCameraDialog = false') {{ $t('cancel') }}
              v-btn(color='var(--cui-primary)' text @click='onRemoveCamera') {{ $t('remove') }}

    AddCamera(@add="cameraAdded" :cameras="cameras")
    v-dialog(v-model="onvifDialog" width="900" scrollable)
      template(v-slot:activator='{ on, attrs }')
        v-btn.tw-mt-3.tw-text-white(block color="var(--cui-primary)" v-bind='attrs' v-on='on' @click='openCameraDiscovery')
          v-icon(left small) {{ icons['mdiAccessPointNetwork'] }}
          span Find / Add Camera
      v-card.onvif-dialog-card
        v-card-title.onvif-dialog-title
          .onvif-title-icon
            v-icon(size="20") {{ onvifMode === 'search' ? icons['mdiAccessPointNetwork'] : icons['mdiCctv'] }}
          span Find / Add Camera
        v-divider
        v-card-text.tw-p-7.text-default.onvif-dialog-body
          v-progress-linear(:active="onvifLoading" :indeterminate="onvifLoading" color="var(--cui-primary)")
          .onvif-mode-toggle.tw-mt-4
            v-btn.onvif-mode-button(:class="{ 'onvif-mode-button--active': onvifMode === 'search' }" depressed @click="onvifMode = 'search'")
              v-icon(left small) {{ icons['mdiAccessPointNetwork'] }}
              span ONVIF Search
            v-btn.onvif-mode-button(:class="{ 'onvif-mode-button--active': onvifMode === 'ipc' }" depressed @click="onvifMode = 'ipc'")
              v-icon(left small) {{ icons['mdiCctv'] }}
              span IPC Camera
          template(v-if="onvifMode === 'search'")
            v-row.tw-mt-3
              v-col(cols="12" md="6")
                label.form-input-label Default RTSP Username
                v-text-field(v-model="onvifUsername" prepend-inner-icon="mdi-account" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAccount'] }}
              v-col(cols="12" md="6")
                label.form-input-label Default RTSP Password
                v-text-field(v-model="onvifPassword" type="password" prepend-inner-icon="mdi-key-variant" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiKeyVariant'] }}
            .onvif-scan-box.tw-mt-3(v-if="onvifLoading || onvifScan")
              .onvif-manual-heading
                v-icon.onvif-manual-icon(size="18") {{ icons['mdiRouterNetwork'] }}
                span DHCP/LAN network scan
              .onvif-device-meta-row
                .onvif-device-pill
                  v-icon.onvif-chip-icon(size="13") {{ icons['mdiAccessPointNetwork'] }}
                  span Hosts: {{ onvifScan ? onvifScan.hostCount : '...' }}
                .onvif-device-pill
                  v-icon.onvif-chip-icon(size="13") {{ icons['mdiNumeric'] }}
                  span Ports: {{ onvifScanPorts() }}
              .tw-text-xs.text-muted.tw-mt-2(v-for="network in onvifScanNetworks()" :key="network.name + network.scanCidr")
                span {{ onvifScanNetworkLabel(network) }}
            .tw-mt-5.tw-text-center.text-muted.onvif-empty-state(v-if="!onvifLoading && !onvifDevices.length")
              v-icon.tw-mr-1(small) {{ icons['mdiAccessPointNetwork'] }}
              span No ONVIF cameras found
          .onvif-ipc-box.tw-mt-5(v-else :class="{ 'onvif-ipc-box--added': ipcAddedCameras().length }")
            .onvif-manual-heading
              v-icon.onvif-manual-icon(size="18") {{ icons['mdiCctv'] }}
              span IPC mode adds a camera directly by IP and RTSP port.
            .onvif-device-meta-row(v-if="ipcAddedCameras().length")
              .onvif-device-pill.onvif-device-pill--added
                v-icon.onvif-chip-icon(size="13") {{ icons['mdiCheckDecagram'] }}
                span Already added: {{ ipcAddedCameras().join(', ') }}
            v-row.tw-mt-2.tw-items-start
              v-col(cols="12" md="4")
                label.form-input-label Camera Name
                v-text-field(v-model="ipcCamera.name" prepend-inner-icon="mdi-camera-iris" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiCameraIris'] }}
              v-col(cols="12" md="4")
                label.form-input-label IP Address
                v-text-field(v-model.trim="ipcCamera.ip" prepend-inner-icon="mdi-ip-network" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo @input="onIpcIpInput")
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiIpNetwork'] }}
              v-col(cols="12" md="4")
                label.form-input-label RTSP Port
                v-text-field(v-model.number="ipcCamera.port" type="number" min="1" max="65535" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo @input="resetIpcRtspResult")
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiNumeric'] }}
              v-col(cols="12" md="4")
                label.form-input-label RTSP Username
                v-text-field(v-model="ipcCamera.username" prepend-inner-icon="mdi-account" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo @input="resetIpcRtspResult")
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAccount'] }}
              v-col(cols="12" md="4")
                label.form-input-label RTSP Password
                v-text-field(v-model="ipcCamera.password" type="password" prepend-inner-icon="mdi-key-variant" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo @input="resetIpcRtspResult")
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiKeyVariant'] }}
              v-col(cols="12" md="4" v-if="ipcCamera.thumbnail || ipcCamera.thumbnailError")
                label.form-input-label
                  v-icon.onvif-label-icon(size="14") {{ icons['mdiImageFrame'] }}
                  span Preview
                .onvif-rtsp-preview-box
                  img.onvif-rtsp-thumbnail(v-if="ipcCamera.thumbnail" :src="ipcCamera.thumbnail" alt="RTSP preview")
                  v-icon.text-muted(v-else size="20") {{ icons['mdiImageFrame'] }}
            .tw-text-sm.tw-mt-1.onvif-result-line(v-if="ipcCamera.rtspMessage" :class="ipcCamera.rtspOk ? 'success--text' : 'error--text'")
              v-icon.tw-mr-1(small) {{ ipcCamera.rtspOk ? icons['mdiCheckCircle'] : icons['mdiCloseCircle'] }}
              span {{ ipcCamera.rtspMessage }}
            .tw-text-xs.text-muted.tw-break-all(v-if="ipcCamera.displayUri") {{ ipcCamera.displayUri }}
            .tw-text-xs.text-muted(v-if="ipcCamera.thumbnailError") Preview unavailable: {{ ipcCamera.thumbnailError }}
            .onvif-ipc-actions.tw-mt-4
              v-btn(color="var(--cui-primary)" text @click="testIpcRtsp" :loading="ipcTesting" :disabled="!!onvifAdding")
                v-icon(left small) {{ icons['mdiTestTube'] }}
                span Test RTSP
              v-btn.tw-text-white(color="success" @click="addIpcCamera" :loading="onvifAdding === 'ipc'" :disabled="ipcTesting")
                v-icon(left small) {{ icons['mdiPlusCircle'] }}
                span Add IPC Camera
          v-expansion-panels.tw-mt-5.onvif-device-list(v-if="onvifMode === 'search' && onvifDevices.length" v-model="onvifPanel")
            v-expansion-panel.onvif-device-panel(v-for="(device, deviceIndex) in onvifDevices" :key="device.ip + ':' + device.port" :class="{ 'onvif-device-panel--active': onvifPanel === deviceIndex, 'onvif-device-panel--added': onvifDeviceAlreadyAdded(device), 'onvif-device-panel--auth': device.authRequired && !device.streams.length }")
              v-expansion-panel-header.onvif-device-header
                .onvif-device-header-content
                  .onvif-device-icon
                    v-icon(size="20") {{ icons['mdiCameraIris'] }}
                  div
                    .page-subtitle.onvif-device-address
                      v-icon.onvif-inline-icon(size="15") {{ icons['mdiIpNetwork'] }}
                      span {{ device.ip }}:{{ device.port }}
                    .page-header-info.tw-mt-1 {{ onvifDeviceLabel(device) }}
                    .onvif-device-meta-row
                      .onvif-device-pill
                        v-icon.onvif-chip-icon(size="13") {{ icons['mdiAccessPointNetwork'] }}
                        span ONVIF
                      .onvif-device-pill(v-if="device.streams.length")
                        v-icon.onvif-chip-icon(size="13") {{ icons['mdiVideoWireless'] }}
                        span {{ device.streams.length }} stream{{ device.streams.length === 1 ? '' : 's' }}
                      .onvif-device-pill.onvif-device-pill--added(v-if="onvifDeviceAlreadyAdded(device)")
                        v-icon.onvif-chip-icon(size="13") {{ icons['mdiCheckDecagram'] }}
                        span Added: {{ onvifDeviceAddedCameras(device).join(', ') }}
                      .onvif-device-pill.onvif-device-pill--warning(v-if="device.authRequired && !device.streams.length")
                        v-icon.onvif-chip-icon(size="13") {{ icons['mdiLockAlert'] }}
                        span Auth needed
                      .onvif-device-pill.onvif-device-pill--manual(v-if="onvifShowManualRtsp(device)")
                        v-icon.onvif-chip-icon(size="13") {{ icons['mdiCctvOff'] }}
                        span Manual RTSP
              v-expansion-panel-content
                .onvif-auth-box(v-if="device.authRequired && !device.streams.length")
                  .onvif-auth-heading
                    v-icon.onvif-auth-icon(size="18") {{ icons['mdiLockAlert'] }}
                    span ONVIF authentication is required before stream details can be read.
                  v-row.tw-mt-2(v-if="onvifDeviceDrafts[onvifDeviceKey(device)]")
                    v-col(cols="12" md="4")
                      label.form-input-label ONVIF Username
                      v-text-field(v-model="onvifDeviceDrafts[onvifDeviceKey(device)].username" prepend-inner-icon="mdi-account" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                        template(v-slot:prepend-inner)
                          v-icon.text-muted {{ icons['mdiAccount'] }}
                    v-col(cols="12" md="4")
                      label.form-input-label ONVIF Password
                      v-text-field(v-model="onvifDeviceDrafts[onvifDeviceKey(device)].password" type="password" prepend-inner-icon="mdi-key-variant" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                        template(v-slot:prepend-inner)
                          v-icon.text-muted {{ icons['mdiKeyVariant'] }}
                    v-col(cols="12" md="4")
                      label.form-input-label &nbsp;
                      v-btn.tw-text-white(block color="var(--cui-primary)" @click="inspectOnvifDevice(device, deviceIndex)" :loading="onvifInspecting === onvifDeviceKey(device)")
                        v-icon(left small) {{ icons['mdiLockOpenVariant'] }}
                        span Load streams
                  .tw-text-sm.tw-mt-1(v-if="onvifDeviceDrafts[onvifDeviceKey(device)] && onvifDeviceDrafts[onvifDeviceKey(device)].message" :class="onvifDeviceDrafts[onvifDeviceKey(device)].ok ? 'success--text' : 'error--text'")
                    v-icon.tw-mr-1(small) {{ onvifDeviceDrafts[onvifDeviceKey(device)].ok ? icons['mdiCheckCircle'] : icons['mdiCloseCircle'] }}
                    span {{ onvifDeviceDrafts[onvifDeviceKey(device)].message }}
                .onvif-manual-box(v-if="onvifShowManualRtsp(device) && onvifManualDrafts[onvifManualKey(device)]")
                  .onvif-manual-heading
                    v-icon.onvif-manual-icon(size="18") {{ icons['mdiCctvOff'] }}
                    span ONVIF was detected, but no stream profiles were returned. Try RTSP directly by IP.
                  v-list.onvif-stream-list(dense color="transparent")
                    v-list-item.onvif-stream-card.onvif-manual-card(:class="onvifManualStateClass(device)")
                      v-list-item-content
                        .onvif-stream-title-row
                          .onvif-stream-badge
                            v-icon.onvif-chip-icon(size="13") {{ icons['mdiVideoWireless'] }}
                            span Manual RTSP
                          .onvif-stream-status(:class="onvifManualStatusClass(device)")
                            v-icon.onvif-chip-icon(size="13") {{ onvifManualStatusIcon(device) }}
                            span {{ onvifManualStatusText(device) }}
                        v-row.tw-mt-2.tw-items-start
                          v-col(cols="12" md="3")
                            label.form-input-label Camera Name
                            v-text-field(v-model="onvifManualDrafts[onvifManualKey(device)].name" prepend-inner-icon="mdi-camera-iris" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                              template(v-slot:prepend-inner)
                                v-icon.text-muted {{ icons['mdiCameraIris'] }}
                          v-col(cols="12" md="3")
                            label.form-input-label RTSP Username
                            v-text-field(v-model="onvifManualDrafts[onvifManualKey(device)].username" prepend-inner-icon="mdi-account" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                              template(v-slot:prepend-inner)
                                v-icon.text-muted {{ icons['mdiAccount'] }}
                          v-col(cols="12" md="3")
                            label.form-input-label RTSP Password
                            v-text-field(v-model="onvifManualDrafts[onvifManualKey(device)].password" type="password" prepend-inner-icon="mdi-key-variant" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                              template(v-slot:prepend-inner)
                                v-icon.text-muted {{ icons['mdiKeyVariant'] }}
                          v-col(cols="12" md="3" v-if="onvifManualDrafts[onvifManualKey(device)].thumbnail || onvifManualDrafts[onvifManualKey(device)].thumbnailError")
                            label.form-input-label
                              v-icon.onvif-label-icon(size="14") {{ icons['mdiImageFrame'] }}
                              span Preview
                            .onvif-rtsp-preview-box
                              img.onvif-rtsp-thumbnail(v-if="onvifManualDrafts[onvifManualKey(device)].thumbnail" :src="onvifManualDrafts[onvifManualKey(device)].thumbnail" alt="RTSP preview")
                              v-icon.text-muted(v-else size="20") {{ icons['mdiImageFrame'] }}
                        .tw-text-sm.tw-mt-1.onvif-result-line(v-if="onvifManualDrafts[onvifManualKey(device)].rtspMessage" :class="onvifManualDrafts[onvifManualKey(device)].rtspOk ? 'success--text' : 'error--text'")
                          v-icon.tw-mr-1(small) {{ onvifManualDrafts[onvifManualKey(device)].rtspOk ? icons['mdiCheckCircle'] : icons['mdiCloseCircle'] }}
                          span {{ onvifManualDrafts[onvifManualKey(device)].rtspMessage }}
                        .tw-text-xs.text-muted.tw-break-all(v-if="onvifManualDrafts[onvifManualKey(device)].displayUri") {{ onvifManualDrafts[onvifManualKey(device)].displayUri }}
                        .tw-text-xs.text-muted(v-if="onvifManualDrafts[onvifManualKey(device)].thumbnailError") Preview unavailable: {{ onvifManualDrafts[onvifManualKey(device)].thumbnailError }}
                      v-list-item-action
                        v-btn.tw-mb-2(small color="var(--cui-primary)" text @click="testOnvifManualRtsp(device)" :loading="onvifTesting === onvifManualLoadingKey(device)" :disabled="!!onvifAdding")
                          v-icon(left small) {{ icons['mdiTestTube'] }}
                          span Test RTSP
                        v-btn.tw-text-white(small color="success" @click="addOnvifManualCamera(device)" :loading="onvifAdding === onvifManualLoadingKey(device)")
                          v-icon(left small) {{ icons['mdiPlusCircle'] }}
                          span Use RTSP
                v-list.onvif-stream-list(dense color="transparent" v-if="device.streams.length")
                  v-list-item.onvif-stream-card(v-for="(stream, streamIndex) in device.streams" :key="device.ip + '-' + stream.token" :class="onvifStreamStateClass(device, stream)")
                    v-list-item-content
                      .onvif-stream-title-row
                        .onvif-stream-badge
                          v-icon.onvif-chip-icon(size="13") {{ icons['mdiVideoWireless'] }}
                          span Stream {{ streamIndex + 1 }}
                        .onvif-stream-status(:class="onvifStreamStatusClass(device, stream)")
                          v-icon.onvif-chip-icon(size="13") {{ onvifStreamStatusIcon(device, stream) }}
                          span {{ onvifStreamStatusText(device, stream) }}
                      v-list-item-title.tw-break-all {{ stream.displayUri || stream.uri }}
                      v-list-item-subtitle {{ stream.token }}
                      v-row.tw-mt-2.tw-items-start(v-if="onvifDrafts[onvifStreamKey(device, stream)]")
                        v-col(cols="12" md="3")
                          label.form-input-label Camera Name
                          v-text-field(v-model="onvifDrafts[onvifStreamKey(device, stream)].name" prepend-inner-icon="mdi-camera-iris" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                            template(v-slot:prepend-inner)
                              v-icon.text-muted {{ icons['mdiCameraIris'] }}
                        v-col(cols="12" md="3")
                          label.form-input-label RTSP Username
                          v-text-field(v-model="onvifDrafts[onvifStreamKey(device, stream)].username" prepend-inner-icon="mdi-account" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                            template(v-slot:prepend-inner)
                              v-icon.text-muted {{ icons['mdiAccount'] }}
                        v-col(cols="12" md="3")
                          label.form-input-label RTSP Password
                          v-text-field(v-model="onvifDrafts[onvifStreamKey(device, stream)].password" type="password" prepend-inner-icon="mdi-key-variant" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                            template(v-slot:prepend-inner)
                              v-icon.text-muted {{ icons['mdiKeyVariant'] }}
                        v-col(cols="12" md="3" v-if="onvifDrafts[onvifStreamKey(device, stream)].thumbnail || onvifDrafts[onvifStreamKey(device, stream)].thumbnailError")
                          label.form-input-label
                            v-icon.onvif-label-icon(size="14") {{ icons['mdiImageFrame'] }}
                            span Preview
                          .onvif-rtsp-preview-box
                            img.onvif-rtsp-thumbnail(v-if="onvifDrafts[onvifStreamKey(device, stream)].thumbnail" :src="onvifDrafts[onvifStreamKey(device, stream)].thumbnail" alt="RTSP preview")
                            v-icon.text-muted(v-else size="20") {{ icons['mdiImageFrame'] }}
                      .tw-text-sm.tw-mt-1.onvif-result-line(v-if="onvifDrafts[onvifStreamKey(device, stream)] && onvifDrafts[onvifStreamKey(device, stream)].rtspMessage" :class="onvifDrafts[onvifStreamKey(device, stream)].rtspOk ? 'success--text' : 'error--text'")
                        v-icon.tw-mr-1(small) {{ onvifDrafts[onvifStreamKey(device, stream)].rtspOk ? icons['mdiCheckCircle'] : icons['mdiCloseCircle'] }}
                        span {{ onvifDrafts[onvifStreamKey(device, stream)].rtspMessage }}
                      .tw-text-xs.text-muted.tw-break-all(v-if="onvifDrafts[onvifStreamKey(device, stream)] && onvifDrafts[onvifStreamKey(device, stream)].displayUri") {{ onvifDrafts[onvifStreamKey(device, stream)].displayUri }}
                      .tw-text-xs.text-muted(v-if="onvifDrafts[onvifStreamKey(device, stream)] && onvifDrafts[onvifStreamKey(device, stream)].thumbnailError") Preview unavailable: {{ onvifDrafts[onvifStreamKey(device, stream)].thumbnailError }}
                    v-list-item-action
                      v-btn.tw-mb-2(small color="var(--cui-primary)" text @click="testOnvifStream(device, stream)" :loading="onvifTesting === device.ip + '-' + stream.token" :disabled="!!onvifAdding")
                        v-icon(left small) {{ icons['mdiTestTube'] }}
                        span Test RTSP
                      v-btn.tw-text-white(small color="success" @click="addOnvifCamera(device, stream)" :loading="onvifAdding === device.ip + '-' + stream.token")
                        v-icon(left small) {{ icons['mdiPlusCircle'] }}
                        span Use stream
        v-divider
        v-card-actions.tw-flex.tw-justify-end
          v-btn.text-default(text @click='onvifDialog = false') {{ $t('close') }}
          v-btn(v-if="onvifMode === 'search'" color='var(--cui-primary)' text @click='discoverOnvif' :loading="onvifLoading")
            v-icon(left small) {{ icons['mdiRefresh'] }}
            span Scan again

    v-divider.tw-my-8

    div(v-if="cameras.length")
      .tw-mt-8(v-for="cam in config.cameras" :key="cam.name")
        div(v-if="camera && camera.name === cam.name")

          v-btn.save-btn(:class="fabAbove ? 'save-btn-top' : ''" v-scroll="onScroll" v-show="fab" color="success" transition="fade-transition" width="40" height="40" fab dark fixed bottom right @click="onSave" :loading="loadingProgress")
            v-icon {{ icons['mdiCheckBold'] }}

          v-sheet.tw-p-3.tw-mb-5.mx-auto.tw-text-sm(rounded width="100%" color="rgba(var(--cui-text-default-rgb), 0.1)")
            span.text-default {{ $t('camera_settings_save_info') }}

          v-expansion-panels(v-model="panel[cam.name]")
            v-expansion-panel
              v-expansion-panel-header
                div
                  .page-subtitle {{ $t('interface') }}
                  .page-header-info.tw-mt-1 {{ $t('camera_interface_info') }}
              v-expansion-panel-content
                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label {{ `${$t('dashboard')} ${$t('livestream')}` }}
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('livestream_snapshot') }}
                  v-switch(color="var(--cui-primary)" v-model="camera.dashboard.live")
                  
                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label {{ `${$t('camview')} ${$t('livestream')}` }}
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('livestream_snapshot') }}
                  v-switch(color="var(--cui-primary)" v-model="camera.camview.live")

                .tw-flex.tw-justify-between.tw-items-center.tw-mb-3
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label {{ $t('record_on_movement') }} ¹
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('record_on_movement_info') }}
                        br(v-if="moduleName === 'homebridge-camera-ui' || env === 'development'")
                        span(style="color: #FF5252 !important" v-if="moduleName === 'homebridge-camera-ui' || env === 'development'") Attention: Enabling this option will disable HSV and disabling this option will enable HSV.
                  v-switch(color="var(--cui-primary)" v-model="cam.recordOnMovement")
                  
                label.form-input-label {{ `${$t('dashboard')} ${$t('snapshot_timer')}` }}
                v-text-field(v-model.number="camera.dashboard.snapshotTimer" type="number" :suffix="$t('seconds')" prepend-inner-icon="mdi-speedometer" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiSpeedometer'] }}

                label.form-input-label {{ `${$t('camview')} ${$t('snapshot_timer')}` }}
                v-text-field(v-model.number="camera.camview.snapshotTimer" type="number" :suffix="$t('seconds')" prepend-inner-icon="mdi-speedometer" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiSpeedometer'] }}

                label.form-input-label {{ $t('room') }}
                v-select.select(prepend-inner-icon="mdi-door" v-model="camera.room" :items="general.rooms" background-color="var(--cui-bg-card)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiDoor'] }}

            v-expansion-panel
              v-expansion-panel-header 
                div
                  .page-subtitle {{ $t('interface_player') }}
                  .page-header-info.tw-mt-1 {{ $t('camera_player_info') }}
              v-expansion-panel-content
                .tw-flex.tw-justify-between.tw-items-center
                  label.form-input-label {{ $t('audio') }}
                  v-switch(color="var(--cui-primary)" v-model="camera.audio")
                
                label.form-input-label {{ $t('video_resolution') }}
                v-select.select(prepend-inner-icon="mdi-video-high-definition" v-model="camera.resolution" :items="resolutions" background-color="var(--cui-bg-card)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiVideoHighDefinition'] }}
                
                label.form-input-label {{ $t('ping_timeout') }}
                v-text-field(v-model.number="camera.pingTimeout" type="number" :suffix="$t('seconds')" prepend-inner-icon="mdi-speedometer" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiSpeedometer'] }}

                label.form-input-label {{ $t('stream_timeout') }}
                v-text-field(v-model.number="camera.streamTimeout" type="number" :suffix="$t('seconds')" prepend-inner-icon="mdi-speedometer" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiSpeedometer'] }}

            v-expansion-panel
              v-expansion-panel-header 
                div
                  .page-subtitle {{ $t('notification') }}
                  .page-header-info.tw-mt-1 {{ $t('camera_notification_info') }}
              v-expansion-panel-content
                .tw-flex.tw-justify-between.tw-items-center
                  label.form-input-label {{ $t('alexa') }}
                  v-switch(color="var(--cui-primary)" v-model="camera.alexa")
                
                label.form-input-label {{ $t('telegram_message_type') }}
                v-select.select(prepend-inner-icon="mdi-video-image" v-model="camera.telegramType" :items="telegramTypes" background-color="var(--cui-bg-card)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiVideoImage'] }}

                label.form-input-label {{ $t('webhook_url') }}
                v-text-field(v-model="camera.webhookUrl" prepend-inner-icon="mdi-link" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiLink'] }}

                label.form-input-label {{ $t('mqtt_publish_topic') }}
                v-text-field(v-model="camera.mqttTopic" prepend-inner-icon="mdi-link" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiLink'] }}

            v-expansion-panel
              v-expansion-panel-header 
                div
                  .page-subtitle {{ $t('rekognition') }}
                  .page-header-info.tw-mt-1 {{ $t('camera_rekognition_info') }}
              v-expansion-panel-content
                .tw-flex.tw-justify-between.tw-items-center
                  label.form-input-label {{ $t('amazon_rekognition') }}
                  v-switch(color="var(--cui-primary)" v-model="camera.rekognition.active")

                label.form-input-label {{ $t('confidence') }}
                v-text-field(v-model.number="camera.rekognition.confidence" type="number" suffix="%" prepend-inner-icon="mdi-percent" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiPercent'] }}

                label.form-input-label {{ $t('labels') }}
                v-combobox(v-model="camera.rekognition.labels" :items="labels" :search-input.sync="search" prepend-inner-icon="mdi-label" hide-selected :label="$t('add_labels')" multiple small-chips solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiLabel'] }}
                  template(v-slot:no-data v-if="search")
                    v-list-item
                      v-list-item-content
                        v-list-item-title 
                          span {{ $t('no_label_matching') }} 
                          strong "{{ search }}"
                          span . {{ $t('press_enter_to_create').split(' %')[0] }} 
                          kbd {{ $t('press_enter_to_create').split(' %')[1].split('% ')[0] }}
                          span  {{ $t('press_enter_to_create').split('% ')[1] }} 

            v-expansion-panel
              v-expansion-panel-header 
                div
                  .page-subtitle {{ $t('alarm') }}
                  .page-header-info.tw-mt-1 {{ $t('camera_alarm_info') }}
              v-expansion-panel-content
                h4.tw-my-3 {{ $t('http') }}

                label.form-input-label {{ $t('motion') }}
                v-text-field(:value="`http://${hostname}:${config.http.port || 7272}/motion?${encodeURIComponent(camera.name)}`" persistent-hint :hint="$t('alarm_http_info')" prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo disabled)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label {{ $t('motion_reset') }}
                v-text-field(:value="`http://${hostname}:${config.http.port || 7272}/reset?${encodeURIComponent(camera.name)}`" persistent-hint :hint="$t('alarm_http_reset_info')" prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo disabled)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                h4.tw-my-3 {{ $t('ftp') }}

                label.form-input-label {{ $t('ftp_absolute_path') }}
                v-text-field(:value="camera.name" persistent-hint :hint="$t('alarm_ftp_info')" prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo disabled)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                h4.tw-my-3 {{ $t('email') }}

                label.form-input-label {{ $t('email_to') }} ¹
                v-text-field(v-model="cam.smtp.email" persistent-hint :hint="$t('email_to_info')" prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label {{ $t('email_from') }} ¹
                v-text-field(v-model="cam.smtp.from" persistent-hint :hint="$t('email_from_info')" prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label {{ $t('email_body_lookup') }} ¹
                v-text-field(v-model="cam.smtp.body" persistent-hint :hint="$t('email_body_lookup_info')" prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                h4.tw-my-3 {{ $t('mqtt') }}

                label.form-input-label Motion Topic ¹
                v-text-field(v-model="cam.mqtt.motionTopic" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Motion Message ¹
                v-text-field(v-model="cam.mqtt.motionMessage" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Motion Reset Topic ¹
                v-text-field(v-model="cam.mqtt.motionResetTopic" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Motion Reset Message ¹
                v-text-field(v-model="cam.mqtt.motionResetMessage" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Doorbell Topic ¹
                v-text-field(v-model="cam.mqtt.doorbellTopic" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Doorbell Message ¹
                v-text-field(v-model="cam.mqtt.doorbellMessage" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                v-divider.tw-mt-1.tw-mb-7

                v-btn.tw-text-white(:loading="prebufferingStates[cam.name].motionLoading" block color="success" @click="triggerMotion(true)") Trigger Motion
                v-btn.tw-text-white.tw-mt-3(:loading="prebufferingStates[cam.name].motionLoading" block color="error" @click="triggerMotion(false)") Reset Motion

            v-expansion-panel(v-if="moduleName === 'homebridge-camera-ui' || env === 'development'")
              v-expansion-panel-header
                div
                  .page-subtitle Homebridge
                  .page-header-info.tw-mt-1 {{ $t('camera_homebridge_info') }}
              v-expansion-panel-content
                v-sheet.tw-p-3.tw-mb-5.mx-auto.tw-text-sm(rounded width="100%" color="rgba(var(--cui-text-default-rgb), 0.1)")
                  span.text-default {{ $t('homebridge_restart_info') }}

                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Disable ¹ ²
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('disable_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.disable")

                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Privacy Mode
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('privacyMode_info') }}
                        br
                        span(style="color: #FF5252 !important") Attention: "At Home" must be enabled for privacy mode to work
                  v-switch(color="var(--cui-primary)" v-model="camera.privacyMode")
                
                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Unbridge (Recommended) ¹ ²
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('unbridge_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.unbridge")
                  
                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Motion Sensor ¹ ²
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('motionSensor_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.motion")
                  
                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Doorbell Sensor ¹ ²
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('doorbellSensor_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.doorbell")
                  
                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Motion / Doorbell Switches ¹ ²
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('motionDoorbellSwitch_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.switches")

                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Privacy Switch ¹ ²
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('privacySwitch_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.privacySwitch")
                  
                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Trigger Doorbell on Motion ¹
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('motionDoorbell_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.motionDoorbell")

                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Exclude Switch ¹ ²
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('excludeSwitch_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.excludeSwitch")

                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Interface Recording Timer ¹
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('use_interface_timer_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.useInterfaceTimer")
                
                label.form-input-label Manufacturer ¹ ²
                v-text-field(v-model="cam.manufacturer" :hint="$t('manufacturer_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}
                      
                label.form-input-label Model ¹ ²
                v-text-field(v-model="cam.model" :hint="$t('model_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}
                      
                label.form-input-label Serial Number ¹ ²
                v-text-field(v-model="cam.serialNumber" :hint="$t('serialNumber_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

            v-expansion-panel
              v-expansion-panel-header 
                div
                  .page-subtitle {{ $t('prebuffering') }}
                  .page-header-info.tw-mt-1 {{ $t('camera_prebuffering_info') }}
              v-expansion-panel-content
                .tw-flex.tw-justify-between.tw-items-center
                  label.form-input-label {{ $t('status') }}
                  span.tw-text-right(:class="!prebufferingStates[cam.name].state ? 'tw-text-red-500' : 'tw-text-green-500'") {{ prebufferingStates[cam.name].state ? $t('active') : $t('inactive') }}

                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label {{ $t('enabled') }} ¹
                  v-switch(color="var(--cui-primary)" v-model="cam.prebuffering")

                v-btn.tw-text-white.tw-mt-3(:disabled="!prebufferingStates[cam.name].state" :loading="prebufferingStates[cam.name].loading" block color="error" @click="onHandlePrebuffering(cam.name, false)") {{ $t('stop') }}
                v-btn.tw-text-white.tw-mt-5(:disabled="!cam.prebuffering" :loading="prebufferingStates[cam.name].loading" block color="success" @click="onHandlePrebuffering(cam.name, true)") {{ $t('restart') }}

            v-expansion-panel
              v-expansion-panel-header 
                div
                  .page-subtitle {{ $t('videoanalysis') }}
                  .page-header-info.tw-mt-1 {{ $t('camera_videoanalysis_info') }}
              v-expansion-panel-content
                .tw-w-full.tw-mt-3.tw-mb-8.tw-relative(v-resize="adjustPlayground" style="background: #000; border-radius: 10px;")
                  .tw-w-full.tw-h-full.tw-flex.tw-justify-center.tw-items-center(v-if="options[cam.name].loading")
                    v-progress-circular(indeterminate color="var(--cui-primary)" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);")
                    v-img.tw-w-full(src="#" :width="playgroundWidth" :height="playgroundHeight")

                  .tw-w-full(v-else)
                    playground(
                      :width="playgroundWidth",
                      :height="playgroundHeight",
                      :options="options[cam.name]"
                      :regions="camera.videoanalysis.regions",
                      :customizing="customizing"
                      @addHandle="addHandle"
                      @updateHandle="updateHandle"
                    )

                .tw-w-full.tw-flex.tw-justify-center.tw-items-center.tw-my-8
                  v-btn(@click="customizing ? finishCustom() : startCustom()") {{ customizing ? $t('finish_zone') : $t('new_zone') }}
                  v-btn.tw-mx-2(@click="undo") {{ $t('undo') }}
                  v-btn(@click="clear") {{ $t('clear') }}

                label.form-input-label {{ $t('dwell_time') }}
                v-slider(:messages="$t('dwell_time_info')" min="15" max="180" step="1" thumb-label v-model="camera.videoanalysis.dwellTimer")
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                .tw-my-3

                label.form-input-label {{ $t('forceClose_timer') }}
                v-slider(:messages="$t('forceClose_timer_info')" min="0" max="10" step="1" thumb-label v-model="camera.videoanalysis.forceCloseTimer")
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                .tw-my-3

                label.form-input-label {{ $t('sensitivity') }}
                v-slider(:messages="$t('sensitivity_info')" min="0" max="100" step="1" thumb-label v-model="camera.videoanalysis.sensitivity")
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}
                
                .tw-my-3
                
                label.form-input-label {{ $t('pixel_difference') }}
                v-slider(:messages="$t('pixel_difference_info')" min="1" max="255" step="1" thumb-label v-model="camera.videoanalysis.difference")
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}
                      
                v-btn.tw-text-white.tw-mt-8(block color="var(--cui-primary)" @click="resetVideoanalysis") {{ $t('reset') }}

                v-divider.tw-mt-10
                
                .tw-flex.tw-justify-between.tw-items-center.tw-mt-10
                  label.form-input-label {{ $t('status') }}
                  span.tw-text-right(:class="!videoanalysisStates[cam.name].state ? 'tw-text-red-500' : 'tw-text-green-500'") {{ videoanalysisStates[cam.name].state ? $t('active') : $t('inactive') }}

                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label {{ $t('enabled') }} ¹
                  v-switch(color="var(--cui-primary)" v-model="cam.videoanalysis.active")

                v-btn.tw-text-white.tw-mt-3(:disabled="!videoanalysisStates[cam.name].state" :loading="videoanalysisStates[cam.name].loading" block color="error" @click="onHandleVideoanalysis(cam.name, false)") {{ $t('stop') }}
                v-btn.tw-text-white.tw-mt-5(:disabled="!cam.videoanalysis" :loading="videoanalysisStates[cam.name].loading" block color="success" @click="onHandleVideoanalysis(cam.name, true)") {{ $t('restart') }}

            v-expansion-panel
              v-expansion-panel-header 
                div
                  .page-subtitle {{ $t('ffmpeg_and_stream') }}
                  .page-header-info.tw-mt-1 {{ $t('camera_ffmpeg_stream_info') }}
              v-expansion-panel-content
                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Debug ¹
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('debug_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.videoConfig.debug")

                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Audio ¹
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('audio_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.videoConfig.audio")
                  
                .tw-flex.tw-justify-between.tw-items-center
                  .tw-block.tw-w-full.tw-pr-2
                    label.form-input-label Read Rate ¹
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ $t('read_rate_info') }}
                  v-switch(color="var(--cui-primary)" v-model="cam.videoConfig.readRate")

                label.form-input-label Video Source ¹
                v-text-field(v-model="cam.videoConfig.source" :hint="$t('source_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Video Subtream Source ¹
                v-text-field(v-model="cam.videoConfig.subSource" :hint="$t('sub_source_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Still Image Source ¹
                v-text-field(v-model="cam.videoConfig.stillImageSource" :hint="$t('still_image_source_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Motion Timeout ¹
                v-text-field(v-model.number="cam.motionTimeout" :hint="$t('motion_timeout_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiNumeric'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Max Streams ¹
                v-text-field(v-model.number="cam.videoConfig.maxStreams" :hint="$t('max_streams_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiNumeric'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Video Width ¹
                v-text-field(v-model.number="cam.videoConfig.maxWidth" :hint="$t('width_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiNumeric'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Video Height ¹
                v-text-field(v-model.number="cam.videoConfig.maxHeight" :hint="$t('height_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiNumeric'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label FPS ¹
                v-text-field(v-model.number="cam.videoConfig.maxFPS" :hint="$t('fps_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiNumeric'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Bitrate ¹
                v-text-field(v-model.number="cam.videoConfig.maxBitrate" :hint="$t('bitrate_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiNumeric'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label RTSP Transport ¹
                v-text-field(v-model="cam.videoConfig.rtspTransport" :hint="$t('rtsp_transport_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Video Codec ¹
                v-text-field(v-model="cam.videoConfig.vcodec" :hint="$t('video_codec_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Audio Codec ¹
                v-text-field(v-model="cam.videoConfig.acodec" :hint="$t('audio_codec_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Stream Timeout ¹
                v-text-field(v-model.number="cam.videoConfig.stimeout" :hint="$t('timeout_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiNumeric'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Analyze Duration ¹
                v-text-field(v-model.number="cam.videoConfig.analyzeDuration" :hint="$t('analyze_duration_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiNumeric'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Probe Size ¹
                v-text-field(v-model.number="cam.videoConfig.probeSize" :hint="$t('probe_size_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiNumeric'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Reorder Queue Size ¹
                v-text-field(v-model.number="cam.videoConfig.reorderQueueSize" :hint="$t('reorder_queue_size_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiNumeric'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Max Timeout ¹
                v-text-field(v-model.number="cam.videoConfig.maxTimeout" :hint="$t('max_delay_info')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiNumeric'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Video Filter ¹
                v-text-field(v-model="cam.videoConfig.vfilter" :hint="$t('video_filter_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Video Stream Map ¹
                v-text-field(v-model="cam.videoConfig.mapvideo" :hint="$t('map_video_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Audio Stream Map ¹
                v-text-field(v-model="cam.videoConfig.mapaudio" :hint="$t('map_audio_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}

                label.form-input-label Encoder Options ¹
                v-text-field(v-model="cam.videoConfig.encoderOptions" :hint="$t('encoder_options_info')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                  template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                  template(v-slot:message="{ key, message}")
                    .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                      v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                      .input-info.tw-italic {{ message }}   
                
                .tw-mt-3(v-if="moduleName === 'homebridge-camera-ui' || env === 'development'")
                  .page-subtitle HKSV Configuration

                  .tw-flex.tw-justify-between.tw-items-center
                    .tw-block.tw-w-full.tw-pr-2
                      label.form-input-label Audio ¹
                      .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                        v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                        .input-info.tw-italic {{ $t('audio_info_hksv') }}
                    v-switch(color="var(--cui-primary)" :input-value="cam.hksvConfig ? cam.hksvConfig.audio : undefined" v-on:change="addToObject(cam, 'hksvConfig', 'audio', $event)")

                  label.form-input-label Video Source ¹
                  v-text-field(:value="cam.hksvConfig ? cam.hksvConfig.source : undefined" v-on:change="addToObject(cam, 'hksvConfig', 'source', $event)" :hint="$t('source_info_hksv')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                    template(v-slot:prepend-inner)
                      v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                    template(v-slot:message="{ key, message}")
                      .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                        v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                        .input-info.tw-italic {{ message }}

                  label.form-input-label Video Width ¹
                  v-text-field(:value="cam.hksvConfig ? cam.hksvConfig.maxWidth : undefined" v-on:change="addToObject(cam, 'hksvConfig', 'maxWidth', $event)" :hint="$t('width_info_hksv')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                    template(v-slot:prepend-inner)
                      v-icon.text-muted {{ icons['mdiNumeric'] }}
                    template(v-slot:message="{ key, message}")
                      .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                        v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                        .input-info.tw-italic {{ message }}

                  label.form-input-label Video Height ¹
                  v-text-field(:value="cam.hksvConfig ? cam.hksvConfig.maxHeight : undefined" v-on:change="addToObject(cam, 'hksvConfig', 'maxHeight', $event)" :hint="$t('height_info_hksv')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                    template(v-slot:prepend-inner)
                      v-icon.text-muted {{ icons['mdiNumeric'] }}
                    template(v-slot:message="{ key, message}")
                      .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                        v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                        .input-info.tw-italic {{ message }}

                  label.form-input-label FPS ¹
                  v-text-field(:value="cam.hksvConfig ? cam.hksvConfig.maxFPS : undefined" v-on:change="addToObject(cam, 'hksvConfig', 'maxFPS', $event)" :hint="$t('fps_info_hksv')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                    template(v-slot:prepend-inner)
                      v-icon.text-muted {{ icons['mdiNumeric'] }}
                    template(v-slot:message="{ key, message}")
                      .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                        v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                        .input-info.tw-italic {{ message }}

                  label.form-input-label Bitrate ¹
                  v-text-field(:value="cam.hksvConfig ? cam.hksvConfig.maxBitrate : undefined" v-on:change="addToObject(cam, 'hksvConfig', 'maxBitrate', $event)" :hint="$t('bitrate_info_hksv')" persistent-hint type="number" prepend-inner-icon="mdi-numeric" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                    template(v-slot:prepend-inner)
                      v-icon.text-muted {{ icons['mdiNumeric'] }}
                    template(v-slot:message="{ key, message}")
                      .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                        v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                        .input-info.tw-italic {{ message }}

                  label.form-input-label Video Codec ¹
                  v-text-field(:value="cam.hksvConfig ? cam.hksvConfig.vcodec : undefined" v-on:change="addToObject(cam, 'hksvConfig', 'vcodec', $event)" :hint="$t('video_codec_info_hksv')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                    template(v-slot:prepend-inner)
                      v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                    template(v-slot:message="{ key, message}")
                      .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                        v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                        .input-info.tw-italic {{ message }}

                  label.form-input-label Audio Codec ¹
                  v-text-field(:value="cam.hksvConfig ? cam.hksvConfig.acodec : undefined" v-on:change="addToObject(cam, 'hksvConfig', 'acodec', $event)" :hint="$t('audio_codec_info_hksv')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                    template(v-slot:prepend-inner)
                      v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                    template(v-slot:message="{ key, message}")
                      .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                        v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                        .input-info.tw-italic {{ message }}

                  label.form-input-label Encoder Options ¹
                  v-text-field(:value="cam.hksvConfig ? cam.hksvConfig.encoderOptions : undefined" v-on:change="addToObject(cam, 'hksvConfig', 'encoderOptions', $event)" :hint="$t('encoder_options_info_hksv')" persistent-hint prepend-inner-icon="mdi-alphabetical" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                    template(v-slot:prepend-inner)
                      v-icon.text-muted {{ icons['mdiAlphabetical'] }}
                    template(v-slot:message="{ key, message}")
                      .tw-flex.tw-flex-row.tw-items-center.tw-break-normal
                        v-icon.text-muted.tw-mr-1(small) {{ icons['mdiInformationOutline'] }}
                        .input-info.tw-italic {{ message }}
</template>

<script>
import {
  mdiAccessPointNetwork,
  mdiAccount,
  mdiAlert,
  mdiAlphabetical,
  mdiCameraIris,
  mdiCheckDecagram,
  mdiCheckCircle,
  mdiCctv,
  mdiCctvOff,
  mdiCheckBold,
  mdiCloseThick,
  mdiCloseCircle,
  mdiDoor,
  mdiHelpCircleOutline,
  mdiImageFrame,
  mdiInformationOutline,
  mdiIpNetwork,
  mdiKeyVariant,
  mdiLabel,
  mdiLink,
  mdiLockAlert,
  mdiLockOpenVariant,
  mdiNumeric,
  mdiPercent,
  mdiPlusCircle,
  mdiProgressClock,
  mdiRefresh,
  mdiRouterNetwork,
  mdiSpeedometer,
  mdiTestTube,
  mdiVideoHighDefinition,
  mdiVideoImage,
  mdiVideoWireless,
} from '@mdi/js';
import {
  addCamera,
  discoverOnvifCameras,
  getCameraSnapshot,
  inspectOnvifCamera,
  removeCamera,
  restartPrebuffering,
  restartVideoanalysis,
  startMotion,
  stopPrebuffering,
  stopVideoanalysis,
  resetMotion,
  testOnvifRtsp,
} from '@/api/cameras.api';
import { changeConfig, getConfig } from '@/api/config.api';
import { getSetting, changeSetting } from '@/api/settings.api';

import AddCamera from '@/components/add-camera.vue';
import playground from '@/components/playground.vue';

import { bus } from '@/main';

export default {
  name: 'CamerasSettings',

  components: {
    AddCamera,
    playground: playground,
  },

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    this.loadingProgress = true;
    next();
  },

  data() {
    return {
      env: '',
      panel: {},

      fab: true,
      fabAbove: false,

      removeCameraDialog: false,
      onvifDialog: false,
      onvifLoading: false,
      onvifAdding: null,
      onvifInspecting: null,
      onvifTesting: null,
      onvifMode: 'search',
      onvifDevices: [],
      onvifScan: null,
      onvifDeviceDrafts: {},
      onvifDrafts: {},
      onvifManualDrafts: {},
      onvifPanel: null,
      onvifUsername: 'admin',
      onvifPassword: '',
      ipcTesting: false,
      ipcCamera: {
        name: 'IPC_Camera',
        ip: '',
        port: 554,
        username: 'admin',
        password: '',
        uri: '',
        displayUri: '',
        thumbnail: '',
        thumbnailError: '',
        rtspOk: false,
        rtspMessage: '',
      },

      icons: {
        mdiAccessPointNetwork,
        mdiAccount,
        mdiAlert,
        mdiAlphabetical,
        mdiCameraIris,
        mdiCheckDecagram,
        mdiCheckCircle,
        mdiCctv,
        mdiCctvOff,
        mdiCheckBold,
        mdiCloseCircle,
        mdiCloseThick,
        mdiDoor,
        mdiHelpCircleOutline,
        mdiImageFrame,
        mdiInformationOutline,
        mdiIpNetwork,
        mdiKeyVariant,
        mdiLabel,
        mdiLink,
        mdiLockAlert,
        mdiLockOpenVariant,
        mdiNumeric,
        mdiPercent,
        mdiPlusCircle,
        mdiProgressClock,
        mdiRefresh,
        mdiRouterNetwork,
        mdiSpeedometer,
        mdiTestTube,
        mdiVideoHighDefinition,
        mdiVideoImage,
        mdiVideoWireless,
      },

      loading: true,
      loadingProgress: true,
      loadingRestartPrebuffering: false,

      camera: {},
      config: {},
      cameras: [],
      camerasTimeout: null,
      configTimeout: null,

      configChanged: false,

      options: {},

      customizing: false,
      playgroundWidth: 0,
      playgroundHeight: 0,

      general: {
        exclude: [],
        rooms: [],
      },

      moduleName: 'camera.ui',
      hostname: window.location.hostname,

      search: null,
      labels: ['Human', 'Face', 'Person', 'Body'],
      resolutions: ['256x144', '426x240', '480x360', '640x480', '1280x720', '1920x1080'],

      telegramTypes: [
        { value: 'Text', text: this.$t('text') },
        { value: 'Snapshot', text: this.$t('snapshot') },
        { value: 'Text + Snapshot', text: `${this.$t('text')} + ${this.$t('snapshot')}` },
        { value: 'Video', text: this.$t('video') },
        { value: 'Text + Video', text: `${this.$t('text')} + ${this.$t('video')}` },
        { value: 'Disabled', text: this.$t('disabled') },
      ],

      prebufferingStates: {},
      videoanalysisStates: {},
    };
  },

  watch: {
    panel: {
      async handler() {
        let panel = [];

        if (this.panel[this.camera.name]) {
          if (!Array.isArray(this.panel[this.camera.name])) {
            panel.push(this.panel[this.camera.name]);
          } else {
            panel = this.panel[this.camera.name].map((i) => i);
          }
        }

        const panelId = this.moduleName === 'homebridge-camera-ui' || this.env === 'development' ? 7 : 6;
        const isVideoAnalysisPanelOpen = panel.some((index) => index === panelId);

        if (isVideoAnalysisPanelOpen && !this.options[this.camera.name]?.background) {
          this.adjustPlayground();

          try {
            const snapshot = await getCameraSnapshot(this.camera.name, '?buffer=true&fromSubSource=true');
            this.options[this.camera.name].background = `data:image/png;base64,${snapshot.data}`;
            this.options[this.camera.name].loading = false;
          } catch (err) {
            console.log(err);
            this.$toast.error(err.message);
          }
        }
      },
      deep: true,
    },
  },

  async created() {
    try {
      this.env = process.env.NODE_ENV;

      const general = await getSetting('general');
      this.general = general.data;

      await this.configCameraSettings();
      await this.configCameras();

      this.camera = this.cameras?.length ? this.cameras[0] : [];

      this.$socket.client.on('prebufferStatus', this.prebufferStatus);
      this.$socket.client.emit(
        'getCameraPrebufferSatus',
        this.cameras.map((camera) => camera.name)
      );

      this.$socket.client.on('videoanalysisStatus', this.videoanalysisStatus);
      this.$socket.client.emit(
        'getCameraVideoanalysisSatus',
        this.cameras.map((camera) => camera.name)
      );

      this.$watch('cameras', this.camerasWatcher, { deep: true });
      this.$watch('camera', this.cameraWatcher, { deep: true });
      this.$watch('config', this.configWatcher, { deep: true });

      this.loading = false;
      this.loadingProgress = false;

      window.addEventListener('resize', this.adjustPlayground);
      window.addEventListener('orientationchange', this.adjustPlayground);

      this.adjustPlayground();
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }
  },

  beforeDestroy() {
    this.$socket.client.off('prebufferStatus', this.prebufferStatus);
    this.$socket.client.off('videoanalysisStatus', this.videoanalysisStatus);

    window.removeEventListener('resize', this.adjustPlayground);
    window.removeEventListener('orientationchange', this.adjustPlayground);
  },

  methods: {
    addToObject(config, objectName, key, value) {
      if (!config[objectName]) {
        config[objectName] = {};
      }

      config[objectName][key] = value;
    },
    openCameraDiscovery() {
      this.onvifMode = 'search';
      this.discoverOnvif();
    },
    async discoverOnvif() {
      if (this.onvifLoading) {
        return;
      }

      this.onvifLoading = true;
      this.onvifPanel = null;
      this.onvifScan = null;

      try {
        const response = await discoverOnvifCameras();
        this.onvifDevices = response.data.result || [];
        this.onvifScan = response.data.scan || null;
        this.initOnvifDrafts();
        const firstUsableDevice = this.onvifDevices.findIndex((device) => (device.streams || []).length);
        this.onvifPanel = firstUsableDevice >= 0 ? firstUsableDevice : null;
      } catch (err) {
        console.log(err);
        this.$toast.error(err.response?.data?.message || err.message);
      }

      this.onvifLoading = false;
    },
    onvifScanNetworkLabel(network) {
      return `${network.name}: ${network.address} -> ${network.scanCidr} (${network.startIp} - ${network.endIp})`;
    },
    onvifScanNetworks() {
      return this.onvifScan?.networks || [];
    },
    onvifScanPorts() {
      return (this.onvifScan?.ports || [8888, 8899, 5000, 8080, 80]).join(', ');
    },
    onvifDeviceLabel(device) {
      const labels = [device.manufacturer, device.model, device.serialNumber].filter(Boolean);

      if (!labels.length && device.authRequired) {
        return 'Authentication required';
      }

      return labels.length ? labels.join(' - ') : 'ONVIF device';
    },
    onvifDeviceKey(device) {
      return `${device.ip}:${device.port}:${device.path}`;
    },
    onvifCameraSourceValues(camera) {
      const videoConfig = camera?.videoConfig || {};

      return [videoConfig.source, videoConfig.subSource, videoConfig.stillImageSource].filter(Boolean);
    },
    cameraNamesForIp(ip) {
      const targetIp = `${ip || ''}`.trim();

      if (!targetIp) {
        return [];
      }

      const escapedIp = targetIp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const ipPattern = new RegExp(`(^|[^0-9.])${escapedIp}([^0-9.]|$)`);

      return (this.config.cameras || [])
        .filter((camera) => this.onvifCameraSourceValues(camera).some((source) => ipPattern.test(source)))
        .map((camera) => camera.name);
    },
    onvifDeviceAddedCameras(device) {
      return this.cameraNamesForIp(device.ip);
    },
    onvifDeviceAlreadyAdded(device) {
      return this.onvifDeviceAddedCameras(device).length > 0;
    },
    ipcAddedCameras() {
      return this.cameraNamesForIp(this.ipcCamera.ip);
    },
    ipcDefaultName(ip = this.ipcCamera.ip) {
      const ipText = `${ip || ''}`.trim();
      const lastPart = ipText.split('.').filter(Boolean).pop() || 'Camera';
      const baseName =
        `IPC_${lastPart}`
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '')
          .slice(0, 32) || 'IPC_Camera';
      let name = baseName;
      let index = 2;

      while (this.cameras.some((camera) => camera.name === name)) {
        name = `${baseName}_${index}`;
        index++;
      }

      return name;
    },
    onIpcIpInput() {
      const currentName = `${this.ipcCamera.name || ''}`.trim();

      if (!currentName || currentName === 'IPC_Camera' || /^IPC_[0-9_]+$/.test(currentName)) {
        this.ipcCamera.name = this.ipcDefaultName();
      }

      this.resetIpcRtspResult();
    },
    resetIpcRtspResult() {
      this.ipcCamera.uri = '';
      this.ipcCamera.displayUri = '';
      this.ipcCamera.thumbnail = '';
      this.ipcCamera.thumbnailError = '';
      this.ipcCamera.rtspOk = false;
      this.ipcCamera.rtspMessage = '';
    },
    validateIpcCamera() {
      const ip = `${this.ipcCamera.ip || ''}`.trim();
      const port = Number(this.ipcCamera.port);
      const name = `${this.ipcCamera.name || ''}`.trim();

      if (!name) {
        this.$toast.error('Camera name is required');
        return null;
      }

      if (!ip) {
        this.$toast.error('IP address is required');
        return null;
      }

      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        this.$toast.error('RTSP port must be between 1 and 65535');
        return null;
      }

      return {
        ip,
        port,
        name,
        username: this.ipcCamera.username || '',
        password: this.ipcCamera.password || '',
      };
    },
    ipcRtspSeedUri(draft) {
      return `rtsp://${draft.ip}:${draft.port}/`;
    },
    onvifShowManualRtsp(device) {
      return !device.authRequired && !(device.streams || []).length;
    },
    onvifManualKey(device) {
      return `${this.onvifDeviceKey(device)}:manual`;
    },
    onvifManualDraft(device) {
      return this.onvifManualDrafts[this.onvifManualKey(device)];
    },
    onvifManualLoadingKey(device) {
      return `${device.ip}-manual`;
    },
    onvifManualStateClass(device) {
      const draft = this.onvifManualDraft(device);
      const loadingKey = this.onvifManualLoadingKey(device);

      return {
        'onvif-stream-card--testing': this.onvifTesting === loadingKey,
        'onvif-stream-card--selected': this.onvifAdding === loadingKey,
        'onvif-stream-card--working': !!draft?.rtspOk,
        'onvif-stream-card--failed': !!draft?.rtspMessage && !draft?.rtspOk && this.onvifTesting !== loadingKey,
      };
    },
    onvifManualStatusText(device) {
      const draft = this.onvifManualDraft(device);
      const loadingKey = this.onvifManualLoadingKey(device);

      if (this.onvifAdding === loadingKey) {
        return 'Adding';
      }

      if (this.onvifTesting === loadingKey) {
        return 'Testing';
      }

      if (draft?.rtspOk) {
        return 'Working';
      }

      if (draft?.rtspMessage) {
        return 'Failed';
      }

      return 'Untested';
    },
    onvifManualStatusIcon(device) {
      const draft = this.onvifManualDraft(device);
      const loadingKey = this.onvifManualLoadingKey(device);

      if (this.onvifAdding === loadingKey) {
        return this.icons.mdiPlusCircle;
      }

      if (this.onvifTesting === loadingKey) {
        return this.icons.mdiProgressClock;
      }

      if (draft?.rtspOk) {
        return this.icons.mdiCheckCircle;
      }

      if (draft?.rtspMessage) {
        return this.icons.mdiCloseCircle;
      }

      return this.icons.mdiHelpCircleOutline;
    },
    onvifManualStatusClass(device) {
      const draft = this.onvifManualDraft(device);
      const loadingKey = this.onvifManualLoadingKey(device);

      return {
        'onvif-stream-status--active': this.onvifAdding === loadingKey || this.onvifTesting === loadingKey,
        'onvif-stream-status--working': !!draft?.rtspOk,
        'onvif-stream-status--failed': !!draft?.rtspMessage && !draft?.rtspOk && this.onvifTesting !== loadingKey,
      };
    },
    onvifStreamKey(device, stream) {
      return `${device.ip}:${device.port}:${stream.token || stream.uri}`;
    },
    onvifStreamDraft(device, stream) {
      return this.onvifDrafts[this.onvifStreamKey(device, stream)];
    },
    onvifStreamLoadingKey(device, stream) {
      return `${device.ip}-${stream.token}`;
    },
    onvifStreamStateClass(device, stream) {
      const draft = this.onvifStreamDraft(device, stream);
      const loadingKey = this.onvifStreamLoadingKey(device, stream);

      return {
        'onvif-stream-card--testing': this.onvifTesting === loadingKey,
        'onvif-stream-card--selected': this.onvifAdding === loadingKey,
        'onvif-stream-card--working': !!draft?.rtspOk,
        'onvif-stream-card--failed': !!draft?.rtspMessage && !draft?.rtspOk && this.onvifTesting !== loadingKey,
      };
    },
    onvifStreamStatusText(device, stream) {
      const draft = this.onvifStreamDraft(device, stream);
      const loadingKey = this.onvifStreamLoadingKey(device, stream);

      if (this.onvifAdding === loadingKey) {
        return 'Adding';
      }

      if (this.onvifTesting === loadingKey) {
        return 'Testing';
      }

      if (draft?.rtspOk) {
        return 'Working';
      }

      if (draft?.rtspMessage) {
        return 'Failed';
      }

      return 'Untested';
    },
    onvifStreamStatusIcon(device, stream) {
      const draft = this.onvifStreamDraft(device, stream);
      const loadingKey = this.onvifStreamLoadingKey(device, stream);

      if (this.onvifAdding === loadingKey) {
        return this.icons.mdiPlusCircle;
      }

      if (this.onvifTesting === loadingKey) {
        return this.icons.mdiProgressClock;
      }

      if (draft?.rtspOk) {
        return this.icons.mdiCheckCircle;
      }

      if (draft?.rtspMessage) {
        return this.icons.mdiCloseCircle;
      }

      return this.icons.mdiHelpCircleOutline;
    },
    onvifStreamStatusClass(device, stream) {
      const draft = this.onvifStreamDraft(device, stream);
      const loadingKey = this.onvifStreamLoadingKey(device, stream);

      return {
        'onvif-stream-status--active': this.onvifAdding === loadingKey || this.onvifTesting === loadingKey,
        'onvif-stream-status--working': !!draft?.rtspOk,
        'onvif-stream-status--failed': !!draft?.rtspMessage && !draft?.rtspOk && this.onvifTesting !== loadingKey,
      };
    },
    async inspectOnvifDevice(device, deviceIndex) {
      const key = this.onvifDeviceKey(device);

      if (this.onvifInspecting) {
        return;
      }

      if (!this.onvifDeviceDrafts[key]) {
        this.$set(this.onvifDeviceDrafts, key, {
          username: this.onvifUsername,
          password: this.onvifPassword,
          ok: false,
          message: '',
        });
      }

      const draft = this.onvifDeviceDrafts[key];
      this.onvifInspecting = key;
      this.$set(draft, 'ok', false);
      this.$set(draft, 'message', 'Checking ONVIF credentials...');

      try {
        const response = await inspectOnvifCamera({
          ip: device.ip,
          port: device.port,
          path: device.path,
          username: draft.username,
          password: draft.password,
        });
        const inspectedDevice = response.data.result;

        this.$set(this.onvifDevices, deviceIndex, {
          ...device,
          ...inspectedDevice,
        });
        this.initOnvifDrafts();

        const nextDraft = this.onvifDeviceDrafts[this.onvifDeviceKey(this.onvifDevices[deviceIndex])];
        const streamCount = inspectedDevice.streams?.length || 0;

        if (streamCount) {
          this.$set(nextDraft, 'ok', true);
          this.$set(nextDraft, 'message', `Loaded ${streamCount} stream${streamCount === 1 ? '' : 's'}`);
          this.onvifPanel = deviceIndex;
        } else {
          this.$set(nextDraft, 'ok', false);
          this.$set(
            nextDraft,
            'message',
            inspectedDevice.authRequired
              ? 'Authentication still failed or the camera rejected ONVIF credentials'
              : 'No ONVIF streams returned'
          );
        }
      } catch (err) {
        console.log(err);
        this.$set(draft, 'message', err.response?.data?.message || err.message);
      }

      this.onvifInspecting = null;
    },
    onvifCameraName(device, stream) {
      const lastOctet = device.ip.split('.').pop();
      const streamIndex = Array.isArray(device.streams) ? device.streams.indexOf(stream) : -1;
      const streamSuffix = streamIndex > 0 ? `s${streamIndex + 1}` : '';
      const label = [device.model || 'Camera', lastOctet, streamSuffix].filter(Boolean).join('_');
      const baseName = label
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 32);
      const finalBaseName = baseName || `Camera_${lastOctet}`;
      let name = finalBaseName;
      let index = 2;

      while (this.cameras.some((camera) => camera.name === name)) {
        name = `${finalBaseName}_${index}`;
        index++;
      }

      return name;
    },
    initOnvifDrafts() {
      const drafts = {};
      const deviceDrafts = {};
      const manualDrafts = {};
      const usedNames = new Set(this.cameras.map((camera) => camera.name));

      this.onvifDevices.forEach((device) => {
        const deviceKey = this.onvifDeviceKey(device);
        const previousDeviceDraft = this.onvifDeviceDrafts[deviceKey] || {};

        deviceDrafts[deviceKey] = {
          username: previousDeviceDraft.username !== undefined ? previousDeviceDraft.username : this.onvifUsername,
          password: previousDeviceDraft.password !== undefined ? previousDeviceDraft.password : this.onvifPassword,
          ok: previousDeviceDraft.ok || false,
          message: previousDeviceDraft.message || '',
        };

        if (this.onvifShowManualRtsp(device)) {
          const manualKey = this.onvifManualKey(device);
          const previousManualDraft = this.onvifManualDrafts[manualKey] || {};
          const baseName = this.onvifCameraName(device, { token: 'manual' });
          let name = previousManualDraft.name || baseName;
          let index = 2;

          while (!previousManualDraft.name && usedNames.has(name)) {
            name = `${baseName}_${index}`;
            index++;
          }

          usedNames.add(name);

          manualDrafts[manualKey] = {
            name,
            username:
              previousManualDraft.username !== undefined
                ? previousManualDraft.username
                : deviceDrafts[deviceKey].username,
            password:
              previousManualDraft.password !== undefined
                ? previousManualDraft.password
                : deviceDrafts[deviceKey].password,
            uri: previousManualDraft.uri || '',
            displayUri: previousManualDraft.displayUri || '',
            thumbnail: previousManualDraft.thumbnail || '',
            thumbnailError: previousManualDraft.thumbnailError || '',
            rtspOk: previousManualDraft.rtspOk || false,
            rtspMessage: previousManualDraft.rtspMessage || '',
          };
        }

        (device.streams || []).forEach((stream) => {
          const key = this.onvifStreamKey(device, stream);
          const baseName = this.onvifCameraName(device, stream);
          let name = baseName;
          let index = 2;

          while (usedNames.has(name)) {
            name = `${baseName}_${index}`;
            index++;
          }

          usedNames.add(name);

          drafts[key] = {
            name,
            username: deviceDrafts[deviceKey].username,
            password: deviceDrafts[deviceKey].password,
            uri: '',
            displayUri: '',
            thumbnail: '',
            thumbnailError: '',
            rtspOk: false,
            rtspMessage: '',
          };
        });
      });

      this.onvifDeviceDrafts = deviceDrafts;
      this.onvifDrafts = drafts;
      this.onvifManualDrafts = manualDrafts;
    },
    onvifStreamUri(uri, draft) {
      if (draft?.uri) {
        return draft.uri;
      }

      if (!draft?.username && !draft?.password) {
        return uri;
      }

      try {
        const rtspUrl = new URL(uri);
        const username = encodeURIComponent(draft.username || '');
        const password = encodeURIComponent(draft.password || '');
        const auth = draft.username || draft.password ? `${username}:${password}@` : '';

        return `rtsp://${auth}${rtspUrl.host}${rtspUrl.pathname}${rtspUrl.search}`;
      } catch (error) {
        return uri;
      }
    },
    onvifStreamSource(stream, draft) {
      return `-i ${this.onvifStreamUri(stream.uri, draft)}`;
    },
    async testOnvifStream(device, stream) {
      const loadingKey = `${device.ip}-${stream.token}`;
      const draft = this.onvifDrafts[this.onvifStreamKey(device, stream)];

      if (!draft || (this.onvifTesting && this.onvifTesting !== loadingKey)) {
        return false;
      }

      this.onvifTesting = loadingKey;
      this.$set(draft, 'rtspOk', false);
      this.$set(draft, 'uri', '');
      this.$set(draft, 'displayUri', '');
      this.$set(draft, 'thumbnail', '');
      this.$set(draft, 'thumbnailError', '');
      this.$set(draft, 'rtspMessage', 'Testing RTSP candidates...');

      try {
        const response = await testOnvifRtsp({
          ip: device.ip,
          uri: stream.uri,
          username: draft.username,
          password: draft.password,
        });
        const result = response.data.result;

        if (result.ok) {
          this.$set(draft, 'rtspOk', true);
          this.$set(draft, 'uri', result.uri);
          this.$set(draft, 'displayUri', result.displayUri);
          this.$set(draft, 'thumbnail', result.thumbnail || '');
          this.$set(draft, 'thumbnailError', result.thumbnailError || '');
          this.$set(draft, 'rtspMessage', `Working RTSP found after ${result.tested} test(s)`);
          this.onvifTesting = null;

          return true;
        } else {
          const firstError = result.failures?.[0]?.error ? `: ${result.failures[0].error}` : '';

          this.$set(draft, 'rtspMessage', `No working RTSP found after ${result.tested} test(s)${firstError}`);
        }
      } catch (err) {
        console.log(err);
        this.$set(draft, 'rtspMessage', err.response?.data?.message || err.message);
      }

      this.onvifTesting = null;

      return false;
    },
    async testOnvifManualRtsp(device) {
      const loadingKey = this.onvifManualLoadingKey(device);
      const draft = this.onvifManualDraft(device);

      if (!draft || (this.onvifTesting && this.onvifTesting !== loadingKey)) {
        return false;
      }

      this.onvifTesting = loadingKey;
      this.$set(draft, 'rtspOk', false);
      this.$set(draft, 'uri', '');
      this.$set(draft, 'displayUri', '');
      this.$set(draft, 'thumbnail', '');
      this.$set(draft, 'thumbnailError', '');
      this.$set(draft, 'rtspMessage', 'Testing common RTSP paths from this IP...');

      try {
        const response = await testOnvifRtsp({
          ip: device.ip,
          username: draft.username,
          password: draft.password,
        });
        const result = response.data.result;

        if (result.ok) {
          this.$set(draft, 'rtspOk', true);
          this.$set(draft, 'uri', result.uri);
          this.$set(draft, 'displayUri', result.displayUri);
          this.$set(draft, 'thumbnail', result.thumbnail || '');
          this.$set(draft, 'thumbnailError', result.thumbnailError || '');
          this.$set(draft, 'rtspMessage', `Working RTSP found after ${result.tested} test(s)`);
          this.onvifTesting = null;

          return true;
        } else {
          const firstError = result.failures?.[0]?.error ? `: ${result.failures[0].error}` : '';

          this.$set(draft, 'rtspMessage', `No working RTSP found after ${result.tested} test(s)${firstError}`);
        }
      } catch (err) {
        console.log(err);
        this.$set(draft, 'rtspMessage', err.response?.data?.message || err.message);
      }

      this.onvifTesting = null;

      return false;
    },
    async testIpcRtsp() {
      if (this.ipcTesting) {
        return false;
      }

      const draft = this.validateIpcCamera();

      if (!draft) {
        return false;
      }

      this.ipcTesting = true;
      this.ipcCamera.rtspOk = false;
      this.ipcCamera.uri = '';
      this.ipcCamera.displayUri = '';
      this.ipcCamera.thumbnail = '';
      this.ipcCamera.thumbnailError = '';
      this.ipcCamera.rtspMessage = 'Testing common RTSP paths from this IP and port...';

      try {
        const response = await testOnvifRtsp({
          ip: draft.ip,
          uri: this.ipcRtspSeedUri(draft),
          username: draft.username,
          password: draft.password,
        });
        const result = response.data.result;

        if (result.ok) {
          this.ipcCamera.rtspOk = true;
          this.ipcCamera.uri = result.uri;
          this.ipcCamera.displayUri = result.displayUri;
          this.ipcCamera.thumbnail = result.thumbnail || '';
          this.ipcCamera.thumbnailError = result.thumbnailError || '';
          this.ipcCamera.rtspMessage = `Working RTSP found after ${result.tested} test(s)`;
          this.ipcTesting = false;

          return true;
        } else {
          const firstError = result.failures?.[0]?.error ? `: ${result.failures[0].error}` : '';

          this.ipcCamera.rtspMessage = `No working RTSP found after ${result.tested} test(s)${firstError}`;
        }
      } catch (err) {
        console.log(err);
        this.ipcCamera.rtspMessage = err.response?.data?.message || err.message;
      }

      this.ipcTesting = false;

      return false;
    },
    async addIpcCamera() {
      if (this.onvifAdding) {
        return;
      }

      const draft = this.validateIpcCamera();

      if (!draft) {
        return;
      }

      if (this.cameras.some((camera) => camera.name === draft.name)) {
        this.$toast.error('Camera name already exists');
        return;
      }

      this.onvifAdding = 'ipc';

      if (!this.ipcCamera.rtspOk) {
        const ok = await this.testIpcRtsp();

        if (!ok) {
          this.$toast.error('No working RTSP URL found');
          this.onvifAdding = null;
          return;
        }
      }

      const source = `-i ${this.ipcCamera.uri}`;
      const camera = {
        name: draft.name,
        manufacturer: 'IPC',
        model: `IP Camera ${draft.ip}`,
        serialNumber: draft.ip,
        motionTimeout: 15,
        recordOnMovement: false,
        prebuffering: false,
        videoConfig: {
          source,
          subSource: source,
          stillImageSource: source,
          rtspTransport: 'tcp',
          stimeout: 10,
          audio: false,
          debug: false,
        },
        mqtt: {},
        smtp: {
          email: draft.name,
        },
        videoanalysis: {
          active: false,
        },
      };

      try {
        await addCamera(camera);
        await this.cameraAdded(camera);

        this.onvifDialog = false;
        this.$toast.success(`${this.$t('successfully_added_camera')}`);
      } catch (err) {
        console.log(err);
        this.$toast.error(err.response?.data?.message || err.message);
      }

      this.onvifAdding = null;
    },
    async addOnvifManualCamera(device) {
      const loadingKey = this.onvifManualLoadingKey(device);

      if (this.onvifAdding) {
        return;
      }

      this.onvifAdding = loadingKey;

      const draft = this.onvifManualDraft(device) || {};
      const name = `${draft.name || this.onvifCameraName(device, { token: 'manual' })}`.trim();

      if (!name) {
        this.$toast.error('Camera name is required');
        this.onvifAdding = null;
        return;
      }

      if (this.cameras.some((camera) => camera.name === name)) {
        this.$toast.error('Camera name already exists');
        this.onvifAdding = null;
        return;
      }

      if (!draft.rtspOk) {
        const ok = await this.testOnvifManualRtsp(device);

        if (!ok) {
          this.$toast.error('No working RTSP URL found');
          this.onvifAdding = null;
          return;
        }
      }

      const source = `-i ${draft.uri}`;
      const camera = {
        name,
        manufacturer: device.manufacturer,
        model: device.model,
        serialNumber: device.serialNumber,
        motionTimeout: 15,
        recordOnMovement: false,
        prebuffering: false,
        videoConfig: {
          source,
          subSource: source,
          stillImageSource: source,
          rtspTransport: 'tcp',
          stimeout: 10,
          audio: false,
          debug: false,
        },
        mqtt: {},
        smtp: {
          email: name,
        },
        videoanalysis: {
          active: false,
        },
      };

      try {
        await addCamera(camera);
        await this.cameraAdded(camera);

        this.onvifDialog = false;
        this.$toast.success(`${this.$t('successfully_added_camera')}`);
      } catch (err) {
        console.log(err);
        this.$toast.error(err.response?.data?.message || err.message);
      }

      this.onvifAdding = null;
    },
    async addOnvifCamera(device, stream) {
      const loadingKey = `${device.ip}-${stream.token}`;

      if (this.onvifAdding) {
        return;
      }

      this.onvifAdding = loadingKey;

      const draft = this.onvifDrafts[this.onvifStreamKey(device, stream)] || {};
      const name = `${draft.name || this.onvifCameraName(device, stream)}`.trim();

      if (!name) {
        this.$toast.error('Camera name is required');
        this.onvifAdding = null;
        return;
      }

      if (this.cameras.some((camera) => camera.name === name)) {
        this.$toast.error('Camera name already exists');
        this.onvifAdding = null;
        return;
      }

      if (!draft.rtspOk) {
        const ok = await this.testOnvifStream(device, stream);

        if (!ok) {
          this.$toast.error('No working RTSP URL found');
          this.onvifAdding = null;
          return;
        }
      }

      const source = this.onvifStreamSource(stream, draft);
      const subStreamItem = device.streams.find((item) => item.token !== stream.token && item.uri);
      const subStream = subStreamItem ? this.onvifStreamSource(subStreamItem, draft) : source;
      const camera = {
        name,
        manufacturer: device.manufacturer,
        model: device.model,
        serialNumber: device.serialNumber,
        motionTimeout: 15,
        recordOnMovement: false,
        prebuffering: false,
        videoConfig: {
          source,
          subSource: subStream,
          stillImageSource: source,
          rtspTransport: 'tcp',
          stimeout: 10,
          audio: false,
          debug: false,
        },
        mqtt: {},
        smtp: {
          email: name,
        },
        videoanalysis: {
          active: false,
        },
      };

      try {
        await addCamera(camera);
        await this.cameraAdded(camera);

        this.onvifDialog = false;
        this.$toast.success(`${this.$t('successfully_added_camera')}`);
      } catch (err) {
        console.log(err);
        this.$toast.error(err.response?.data?.message || err.message);
      }

      this.onvifAdding = null;
    },
    async cameraAdded(camera) {
      try {
        await this.configCameraSettings();
        await this.configCameras();

        const cameraIndex = this.cameras.findIndex((cam) => cam.name === camera.name);
        this.camera = this.cameras[cameraIndex] || {};
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }
    },
    async configCameras() {
      const config = await getConfig('?target=config');

      this.moduleName = config.data.env.moduleName;

      this.config = {
        port: config.data.port || window.location.port || 80,
        logLevel: config.data.logLevel || 'info',
        ssl: config.data.ssl || {
          key: '',
          cert: '',
        },
        http: config.data.http || {
          active: false,
          localhttp: false,
          port: 7272,
        },
        mqtt: config.data.mqtt || {
          active: false,
          host: '',
          port: 1883,
        },
        smtp: config.data.smtp || {
          active: false,
          port: 2525,
          space_replace: '+',
        },
        ftp: config.data.ftp || {
          active: false,
          port: 5050,
        },
        options: config.data.options || {
          videoProcessor: 'ffmpeg',
        },
        cameras: (config.data.cameras || []).map((camera) => {
          camera.mqtt = camera.mqtt || {};
          camera.videoanalysis = camera.videoanalysis || {};
          camera.smtp = camera.smtp || {};

          this.$set(this.panel, camera.name, []);

          this.$set(this.prebufferingStates, camera.name, {
            state: false,
            loading: false,
            motionLoading: false,
          });

          this.$set(this.videoanalysisStates, camera.name, {
            state: false,
            loading: false,
          });

          this.$set(this.options, camera.name, {
            loading: true,
            background: '',
          });

          return camera;
        }),
      };
    },
    async configCameraSettings() {
      const cameras = await getSetting('cameras');
      this.cameras = cameras.data;
    },
    async onSave() {
      this.loadingProgress = true;

      try {
        await changeConfig(this.config);
        this.$toast.success(this.$t('config_was_saved'));
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.configChanged = false;
      this.loadingProgress = false;
    },
    async cameraWatcher() {
      this.cameras = this.cameras.map((camera) => {
        if (camera.name === this.camera.name) {
          camera = this.camera;
        }
        return camera;
      });
    },
    async camerasWatcher() {
      this.loadingProgress = true;

      if (this.camerasTimeout) {
        clearTimeout(this.camerasTimeout);
        this.camerasTimeout = null;
      }

      this.camerasTimeout = setTimeout(async () => {
        try {
          await changeSetting('cameras', this.cameras, '?stopStream=true');
        } catch (err) {
          console.log(err);
          this.$toast.error(err.message);
        }

        this.loadingProgress = false;
      }, 2000);
    },
    async configWatcher() {
      this.configChanged = true;
    },
    async onHandlePrebuffering(cameraName, restart) {
      if (this.prebufferingStates[cameraName].loading) {
        return;
      }

      this.prebufferingStates[cameraName].loading = true;

      try {
        if (restart) {
          await restartPrebuffering(cameraName);
        } else {
          await stopPrebuffering(cameraName);
        }
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.prebufferingStates[cameraName].loading = false;
    },
    async onHandleVideoanalysis(cameraName, restart) {
      if (this.videoanalysisStates[cameraName].loading) {
        return;
      }

      this.videoanalysisStates[cameraName].loading = true;

      try {
        if (restart) {
          await restartVideoanalysis(cameraName);
        } else {
          await stopVideoanalysis(cameraName);
        }
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.videoanalysisStates[cameraName].loading = false;
    },
    async onRemoveCamera() {
      if (!this.camera) {
        return this.$toast.error(this.$t('no_camera_selected'));
      }

      const cameraName = this.camera.name;
      const cameraIndex = this.cameras.findIndex((camera) => camera.name === cameraName);

      try {
        await removeCamera(cameraName);
        this.removeCameraDialog = false;

        setTimeout(() => {
          //this.cameras = this.cameras.filter((camera) => camera.name !== cameraName);

          this.$delete(this.cameras, cameraIndex);
          this.camera = this.cameras[0] || {};

          delete this.panel[cameraName];
          delete this.prebufferingStates[cameraName];
          delete this.videoanalysisStates[cameraName];
          delete this.options[cameraName];
        }, 500);

        this.$toast.success(`${this.$t('successfully_removed')}`);
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);

        this.removeCameraDialog = false;
      }
    },
    onScroll(e) {
      if (typeof window === 'undefined') {
        this.fabAbove = true;
        return;
      }

      const top = window.pageYOffset || e.target.scrollTop || 0;
      this.fabAbove = top > 20;
    },
    prebufferStatus(data) {
      if (this.prebufferingStates[data.camera]) {
        this.prebufferingStates[data.camera].state = data.status === 'active';
      }
    },
    resetVideoanalysis() {
      if (this.camera) {
        const DEFAULT_FORCECLOSE_TIME = 3;
        const DEFAULT_DWELL_TIME = 60;
        const DEFAULT_DIFFERENCE = 5; // 1 - 255
        const DEFAULT_SENSITIVITY = 75; // 0 - 100

        this.camera.videoanalysis = {
          ...this.camera.videoanalysis,
          sensitivity: DEFAULT_SENSITIVITY,
          difference: DEFAULT_DIFFERENCE,
          dwellTimer: DEFAULT_DWELL_TIME,
          forceCloseTimer: DEFAULT_FORCECLOSE_TIME,
        };
      }
    },
    async triggerMotion(state) {
      if (!this.camera) {
        return this.$toast.error(this.$t('no_camera_selected'));
      }

      if (this.prebufferingStates[this.camera.name].motionLoading) {
        return;
      }

      this.prebufferingStates[this.camera.name].motionLoading = true;

      try {
        if (state) {
          await startMotion(this.camera.name);
        } else {
          await resetMotion(this.camera.name);
        }
        this.$toast.success(this.$t('successfull'));
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.prebufferingStates[this.camera.name].motionLoading = false;
    },
    videoanalysisStatus(data) {
      if (this.videoanalysisStates[data.camera]) {
        this.videoanalysisStates[data.camera].state = data.status === 'active';
      }
    },
    addHandle(e) {
      let x = Math.round(((e.offsetX - 10) / this.playgroundWidth) * 100);
      let y = Math.round(((e.offsetY - 10) / this.playgroundHeight) * 100);

      const regionIndex = this.camera.videoanalysis.regions?.length
        ? this.camera.videoanalysis.regions[this.camera.videoanalysis.regions.length - 1].finished
          ? this.camera.videoanalysis.regions.length
          : this.camera.videoanalysis.regions.length - 1
        : 0;

      if (!this.camera.videoanalysis.regions[regionIndex]) {
        this.camera.videoanalysis.regions.push({
          finished: false,
          coords: [],
        });
      }

      this.camera.videoanalysis.regions[regionIndex].coords.push([x, y]);

      bus.$emit('handleAdded', {
        cIndex: this.camera.videoanalysis.regions[regionIndex].coords.length - 1,
        rIndex: regionIndex,
        coord: [x, y],
      });
    },
    updateHandle(payload) {
      let x = Math.round((payload.x / this.playgroundWidth) * 100);
      let y = Math.round((payload.y / this.playgroundHeight) * 100);

      this.$set(this.camera.videoanalysis.regions[payload.regionIndex].coords, payload.coordIndex, [x, y]);
    },
    undo() {
      if (!this.camera.videoanalysis.regions?.length) {
        return;
      }

      const rIndex = this.camera.videoanalysis.regions.length - 1;
      this.camera.videoanalysis.regions[rIndex]?.coords?.pop();

      if (!this.camera.videoanalysis.regions[rIndex].coords?.length) {
        this.camera.videoanalysis.regions = this.camera.videoanalysis.regions.filter((region, i) => i !== rIndex);
      } else if (!this.customizing && this.camera.videoanalysis.regions[rIndex].coords?.length < 3) {
        this.camera.videoanalysis.regions = this.camera.videoanalysis.regions.filter((region, i) => i !== rIndex);
      }
    },
    clear() {
      this.camera.videoanalysis.regions = [];
      bus.$emit('clearDraggs');
    },
    startCustom() {
      this.customizing = true;
    },
    finishCustom() {
      this.customizing = false;

      if (!this.camera.videoanalysis.regions?.length) {
        return;
      }

      const rIndex = this.camera.videoanalysis.regions.length - 1;

      if (this.camera.videoanalysis.regions[this.camera.videoanalysis.regions.length - 1].coords.length < 3) {
        this.camera.videoanalysis.regions = this.camera.videoanalysis.regions.filter((region, i) => i !== rIndex);
      } else {
        this.camera.videoanalysis.regions[rIndex].finished = true;
        bus.$emit('customizingFinished');
      }
    },
    adjustPlayground() {
      if (this.$refs.innerContainer && this.camera.name) {
        const width = this.$refs.innerContainer.offsetWidth;
        const height = (width - 20) / (16 / 9);

        this.playgroundWidth = width - 20;
        this.playgroundHeight = height;
      }
    },
  },
};
</script>

<style scoped>
.save-btn {
  right: 30px !important;
  bottom: 45px !important;
  z-index: 11 !important;
  transition: 0.3s all;
}

.save-btn-top {
  bottom: 95px !important;
}

.onvif-rtsp-preview-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 58px;
  height: 58px;
  border: 1px solid rgba(var(--cui-text-default-rgb), 0.18);
  border-radius: 4px;
  background: rgba(var(--cui-text-default-rgb), 0.08);
  overflow: hidden;
  font-size: 0.625rem;
  line-height: 1.1;
  text-align: center;
}

.onvif-rtsp-thumbnail {
  display: block;
  width: 56px !important;
  min-width: 56px !important;
  max-width: 56px !important;
  height: 56px !important;
  min-height: 56px !important;
  max-height: 56px !important;
  object-fit: cover;
}

div >>> .v-chip .v-chip__content {
  color: #fff !important;
}

div >>> .v-expansion-panels .v-expansion-panel {
  background: none;
  color: var(--cui-text-default);
  border-bottom: 1px solid rgba(var(--cui-text-default-rgb), 0.12);
  border-bottom-left-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}

div >>> .v-expansion-panel-header {
  padding-left: 0;
  padding-right: 0;
}

div >>> .v-expansion-panel-content__wrap {
  padding-left: 0;
  padding-right: 0;
}

div >>> .v-expansion-panel::before {
  box-shadow: unset;
}

div >>> .theme--light.v-expansion-panels .v-expansion-panel-header .v-expansion-panel-header__icon .v-icon {
  color: rgba(var(--cui-text-default-rgb), 0.4);
}

div >>> .v-expansion-panel:not(:first-child)::after {
  border: none;
}

.onvif-dialog-card {
  background: #f3f6f8 !important;
}

.onvif-dialog-title {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #ffffff;
  border-bottom: 1px solid rgba(var(--cui-text-default-rgb), 0.1);
}

.onvif-title-icon,
.onvif-device-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border-radius: 7px;
  color: #2b7ab9;
  background: #e7f2ff;
}

.onvif-dialog-body {
  background: #f3f6f8;
}

.onvif-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
}

.onvif-mode-toggle {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 5px;
  border: 1px solid rgba(var(--cui-text-default-rgb), 0.12);
  border-radius: 7px;
  background: #ffffff;
}

.onvif-mode-button {
  min-height: 40px;
  border-radius: 5px;
  color: #5a6673 !important;
  background: #eef2f6 !important;
  text-transform: none;
  letter-spacing: 0;
}

.onvif-mode-button--active {
  color: #ffffff !important;
  background: #2b7ab9 !important;
  box-shadow: 0 6px 14px rgba(43, 122, 185, 0.22);
}

.onvif-ipc-box {
  padding: 14px;
  border: 1px solid rgba(43, 122, 185, 0.26);
  border-left: 4px solid #2b7ab9;
  border-radius: 6px;
  background: #f4f9ff;
}

.onvif-ipc-box--added {
  border-color: rgba(123, 97, 209, 0.42);
  border-left-color: #7b61d1;
  background: #f6f1ff;
}

.onvif-ipc-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.onvif-device-list {
  gap: 10px;
}

div >>> .onvif-device-panel {
  background: #ffffff !important;
  border: 1px solid rgba(var(--cui-text-default-rgb), 0.14);
  border-left: 4px solid #a9b4c0;
  border-radius: 6px !important;
  margin-bottom: 10px;
  overflow: hidden;
}

div >>> .onvif-device-panel--active {
  background: #eef6ff !important;
  border-color: rgba(43, 122, 185, 0.42);
  border-left-color: #2b7ab9;
  box-shadow: 0 8px 20px rgba(35, 65, 95, 0.14);
}

div >>> .onvif-device-panel--active .v-expansion-panel-header {
  background: #e7f2ff;
}

div >>> .onvif-device-panel--auth {
  background: #fffaf0 !important;
  border-color: rgba(204, 142, 28, 0.4);
  border-left-color: #cc8e1c;
}

div >>> .onvif-device-panel--auth .v-expansion-panel-header {
  background: #fff5dc;
}

div >>> .onvif-device-panel--added {
  background: #f6f1ff !important;
  border-color: rgba(123, 97, 209, 0.42);
  border-left-color: #7b61d1;
}

div >>> .onvif-device-panel--added .v-expansion-panel-header {
  background: #efe7ff;
}

.onvif-device-header-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.onvif-device-address,
.onvif-device-meta-row,
.onvif-device-pill,
.onvif-result-line {
  display: flex;
  align-items: center;
}

.onvif-device-address {
  gap: 5px;
}

.onvif-inline-icon,
.onvif-label-icon {
  color: rgba(var(--cui-text-default-rgb), 0.62) !important;
}

.onvif-label-icon {
  margin-right: 4px;
  vertical-align: -2px;
}

.onvif-device-meta-row {
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.onvif-device-pill {
  min-height: 20px;
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1;
  color: #2d5d86;
  background: #dceeff;
}

.onvif-device-pill--warning {
  color: #8a5d00;
  background: #fff0cc;
}

.onvif-device-pill--added {
  color: #5840a8;
  background: #e5dcff;
}

.onvif-device-pill--manual {
  color: #2d5d86;
  background: #e4f1ff;
}

.onvif-auth-box {
  padding: 12px;
  border: 1px solid rgba(204, 142, 28, 0.28);
  border-radius: 6px;
  background: #fffaf0;
}

.onvif-auth-heading {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #8a5d00;
  font-size: 0.86rem;
  font-weight: 600;
}

.onvif-auth-icon {
  color: #cc8e1c !important;
}

.onvif-manual-box {
  padding: 12px;
  border: 1px solid rgba(43, 122, 185, 0.24);
  border-radius: 6px;
  background: #f4f9ff;
}

.onvif-scan-box {
  padding: 12px;
  border: 1px solid rgba(43, 122, 185, 0.22);
  border-left: 4px solid #2b7ab9;
  border-radius: 6px;
  background: #ffffff;
}

.onvif-manual-heading {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #2d5d86;
  font-size: 0.86rem;
  font-weight: 600;
}

.onvif-manual-icon {
  color: #2b7ab9 !important;
}

.onvif-stream-list {
  padding: 0;
}

div >>> .onvif-stream-card {
  align-items: flex-start;
  background: #f8fafc;
  border: 1px solid rgba(var(--cui-text-default-rgb), 0.13);
  border-left: 4px solid #a9b4c0;
  border-radius: 6px;
  margin: 10px 0;
  min-height: 0;
  padding: 10px 12px !important;
}

div >>> .onvif-stream-card--testing {
  background: #fff8e8;
  border-color: rgba(204, 142, 28, 0.44);
  border-left-color: #cc8e1c;
}

div >>> .onvif-stream-card--working {
  background: #effaf2;
  border-color: rgba(46, 174, 95, 0.5);
  border-left-color: #2eae5f;
}

div >>> .onvif-stream-card--failed {
  background: #fff1f1;
  border-color: rgba(203, 67, 67, 0.45);
  border-left-color: #cb4343;
}

div >>> .onvif-stream-card--selected {
  box-shadow: inset 0 0 0 2px rgba(46, 174, 95, 0.28);
}

div >>> .onvif-manual-card {
  background: #ffffff;
}

.onvif-stream-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.onvif-stream-badge,
.onvif-stream-status {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1;
}

.onvif-stream-badge {
  background: #22313f;
  color: #ffffff;
}

.onvif-stream-status {
  background: #e1e7ee;
  color: #52606d;
}

.onvif-stream-status--active {
  background: #fff0cc;
  color: #8a5d00;
}

.onvif-stream-status--working {
  background: #d9f4df;
  color: #1f7d42;
}

.onvif-stream-status--failed {
  background: #ffe0e0;
  color: #a33131;
}

.onvif-chip-icon {
  flex: 0 0 auto;
  margin-right: 4px;
  color: currentColor !important;
}

/*div >>> .v-expansion-panels > *:last-child {
  border: none !important;
}*/

div >>> .v-slider__thumb-label {
  color: #fff !important;
}

div >>> .v-slider__track-background.primary.lighten-3 {
  background-color: #5a5a5a !important;
  border-color: #5a5a5a !important;
}
</style>

<style scoped lang="scss">
main {
  display: flex;
  flex-direction: column;

  @media (min-width: 800px) {
    position: fixed;
    top: 0;
    left: 0;
    height: 100%;
    right: 23.625rem;
    padding: 0.25rem 0.25rem 0.25rem 0.75rem;
    touch-action: none;

    .panel.dark {
      display: none;
    }
  }

  header {
    justify-content: space-between;
    background: rgba(251, 252, 247, 0.75);
    box-shadow: inset 0 -1px rgba(211, 208, 201, 0.25);
    padding: 0.75rem 1rem;

    @media (min-width: 800px) {
      font-size: larger;
      padding: 0.75rem 1rem;
      border-radius: 2px 2px 0 0;
    }

    h1 {
      padding: 0.25rem;
      font-size: 1rem;
      font-weight: 400;
    }
  }
}
</style>
