<p align="center">
    <img src="images/logo.png">
</p>

# camera.ui for Windows

[![GitHub release](https://img.shields.io/github/v/release/zombrax1/camera.ui?style=flat-square)](https://github.com/zombrax1/camera.ui/releases)
[![GitHub last commit](https://img.shields.io/github/last-commit/zombrax1/camera.ui.svg?style=flat-square)](https://github.com/zombrax1/camera.ui)

**camera.ui** is a Windows app to watch and record your IP cameras (any camera with RTSP or ONVIF), like a small NVR on your PC.

- **Camview**: see up to 32 cameras live at the same time
- **Find cameras automatically** with ONVIF search, or add them by IP address
- **Recordings** of snapshots or videos when motion is detected
- **Motion detection** by video analysis, MQTT, FTP, SMTP or HTTP
- **Notifications** via Telegram, Webhook, Alexa and web push
- **Use it from your phone** or another PC in the same network, in the browser
- **Dashboard** with widgets, 8 color themes, dark mode, multi-language (:de: :gb: :netherlands: :fr: :thailand: :es:)

## Contents

- [Install](#install)
- [First start](#first-start)
- [Add cameras](#add-cameras)
- [Camview: many cameras at once](#camview-many-cameras-at-once)
- [Open camera.ui on your phone or another PC](#open-cameraui-on-your-phone-or-another-pc)
- [Keep camera.ui running](#keep-cameraui-running)
- [Update](#update)
- [Your data and backups](#your-data-and-backups)
- [Uninstall](#uninstall)
- [Troubleshooting](#troubleshooting)
- [Features in detail](#features-in-detail)
- [Recommended camera settings](#recommended-camera-settings)
- [License](#license)

## Install

You need:

- **Windows 10 or 11** (64-bit)
- The PC and the cameras in the **same network**
- **Port 8081** free on the PC (nothing else using it)

Steps:

1. Go to [**Releases**](https://github.com/zombrax1/camera.ui/releases) and open the newest release.
2. Under **Assets**, download **`camera.ui Setup <version>.exe`**.
3. Run the downloaded file and follow the installer.
4. Start **camera.ui** from the desktop shortcut or the Start Menu.

Everything is included in the installer (the app, the camera server and ffmpeg). You don't need to install anything else.

> [!NOTE]
> Windows may show **"Windows protected your PC"** because the installer is not signed. Click **More info**, then **Run anyway**.

## First start

The first start can take a few seconds while the camera server starts. Then sign in with:

- Username: `master`
- Password: `master`

Change the password right away in the account settings.

## Add cameras

Go to **Settings → Cameras → Find / Add Camera**.

**ONVIF Search** (easiest): camera.ui searches your network for cameras. Enter the camera's username and password if it asks for one. Many cameras use `admin`, some need their own ONVIF account. If a camera is not found, turn on ONVIF in the camera's own settings page.

**IPC Camera** (manual): enter the camera name, IP address, RTSP port (usually `554`), username and password. Leave the password empty if the camera has none. Click **Test RTSP** first and add the camera when the test works. A small preview picture shows when camera.ui can read the stream.

Cameras that are already in your list are highlighted, so you don't add the same IP twice.

## Camview: many cameras at once

Camview shows all your cameras as live tiles. Up to 32 cameras play live at the same time, and they start together.

For the smoothest picture:

- **Set a substream for every camera.** With 6 or more cameras, Camview uses each camera's low resolution substream. Set it in **Settings → Cameras → (your camera) → Video Substream Source**. Without a substream, all cameras send their full main stream, which is much heavier for the PC.
- **Use H.264** for the substream (in the camera's own settings page). H.265 only plays directly if the PC's graphics card supports it. Otherwise camera.ui converts it, which is limited to 4 cameras in a big Camview; the others then show a picture that refreshes every few seconds.
- **Live or picture:** each camera has a **Camview Livestream** switch in **Settings → Cameras**. When it is off, the tile shows a picture that refreshes instead of live video.

If a camera goes offline, only its own tile shows **Offline**. All other cameras keep playing, and the camera comes back by itself when it is reachable again. You can also click the reload button on the tile.

## Open camera.ui on your phone or another PC

camera.ui also works in the browser of other devices in the same network:

1. Find the IP address of the camera.ui PC: press **Windows + R**, type `cmd`, press Enter, type `ipconfig` and look for **IPv4 Address** (for example `192.168.1.20`).
2. On your phone or other PC, open `http://192.168.1.20:8081` (use your PC's address).

If it doesn't open, allow camera.ui in the Windows Firewall: **Windows Security → Firewall & network protection → Allow an app through firewall → camera.ui**, tick **Private**.

## Keep camera.ui running

camera.ui only works while the app is open. **Closing the window stops camera.ui**, including recordings, motion detection and access from other devices.

To start camera.ui automatically when Windows starts:

1. Press **Windows + R**, type `shell:startup` and press Enter. A folder opens.
2. Copy the **camera.ui** desktop shortcut into that folder.

Also make sure the PC doesn't go to sleep: **Settings → System → Power → Screen and sleep → "When plugged in, put my device to sleep after" → Never**.

## Update

1. In camera.ui go to **Settings → System**. When a new version is available, click the update button next to **Windows installer release**, then **Download installer**.
   (Or download the newest **`camera.ui Setup <version>.exe`** from [Releases](https://github.com/zombrax1/camera.ui/releases).)
2. Close camera.ui.
3. Run the new installer. Your cameras, settings and recordings are kept.

## Your data and backups

All your data is stored in `%APPDATA%\camera.ui` (paste this into the File Explorer address bar to open it):

- `config.json`: your cameras and settings
- `database`: users, notifications and app settings
- `recordings`: your recorded pictures and videos
- `logs`: log files, useful when something doesn't work

To make a backup, go to **Settings → Backup** and download it. You can restore it there too, also on another PC. A backup from a newer camera.ui version must be restored with that version or newer.

## Uninstall

**Windows Settings → Apps → Installed apps → camera.ui → Uninstall.**

Your data in `%APPDATA%\camera.ui` stays on the PC. Delete that folder too if you want to remove everything.

## Troubleshooting

- **"camera.ui failed to start"**: another program may be using port `8081`. Close it, or restart the PC and try again.
- **The installer keeps asking to close camera.ui**: close camera.ui, open **Task Manager** (Ctrl+Shift+Esc), end any **camera.ui** and **ffmpeg** tasks, then run the installer again.
- **A camera shows Offline**: check that the camera has power and network, and that you can reach it from the PC. If the IP is right but it still doesn't work, the RTSP port, path, username or password may be wrong. Use **IPC Camera → Test RTSP** to find the right settings.
- **ONVIF search finds nothing**: turn on ONVIF in the camera's own settings page, check that the camera and PC are in the same network, then search again.
- **Camview is slow or jerky**: set a substream (H.264, low resolution) for every camera, see [Camview](#camview-many-cameras-at-once).
- **Other devices can't open camera.ui**: see [Open camera.ui on your phone or another PC](#open-cameraui-on-your-phone-or-another-pc) and allow camera.ui in the firewall.
- **Need more details**: set the log level to **debug** in **Settings → System**, then look at **Log** in the menu or the files in `%APPDATA%\camera.ui\logs`.

## Features in detail

### Dashboard

The main page, with widgets you can arrange: time, weather, uptime, cameras, notifications, RSS feed, status, charts (CPU load, CPU temperature, memory), shortcuts and log.

<img src="images/browser/dashboard.png" align="center" alt="Dashboard">

### Cameras

All cameras sorted by room, each with its latest snapshot.

<img src="images/browser/cameras.png" align="center" alt="Cameras">

### Camera

Click a camera to watch it live. You can pause, turn audio on or off and reload the stream.

<img src="images/browser/camera.png" align="center" alt="Camera">

### Recordings

All pictures and videos recorded on motion, with date, time and (with AWS Rekognition) what was detected. Use the filter to find recordings.

<img src="images/browser/recordings.png" align="center" alt="Recordings">

### Notifications

All motion events and system messages, with labels and a filter.

<img src="images/browser/notifications.png" align="center" alt="Notifications">

### Camview

All cameras as live tiles. Drag and resize tiles, choose a layout (4, 9, 16, 25 or 32), or open a camera in full size.

<img src="images/browser/camview.png" align="center" alt="Camview">

### Log, Config and Utilization

- **Log**: see what camera.ui is doing, clear or download the log.
- **Config**: edit the settings file directly, with error checking.
- **Utilization**: live charts of CPU load, CPU temperature and memory.

### Motion detection

- **Video analysis**: camera.ui watches the video and detects changes. Set zones and sensitivity per camera.
- **HTTP**: turn on the HTTP server in the settings and open `http://<PC-IP>:7272/motion?My%20Camera` to trigger motion for the camera "My Camera" (spaces as `%20`).
- **MQTT**: set up the MQTT client in **Settings → System → MQTT**, then set the motion topic and message per camera in **Settings → Cameras**. The message can be text (for example `ON`) or JSON, for example `{"event": {"state": true}}`.
- **SMTP**: if your camera can send an email on motion, turn on the camera.ui SMTP server and send to `My+Camera@camera.ui` (the camera name, spaces as `+`).
- **FTP**: if your camera can upload a picture on motion, use the camera.ui FTP server as target. The upload path must be the camera name in camera.ui.

### Image recognition

With an AWS account, camera.ui can use AWS Rekognition to check what is in a motion picture (person, car, animal, ...) before it records or notifies. Turn it on per camera and choose the labels you care about. See [AWS Rekognition](https://aws.amazon.com/rekognition/).

### Notifications

Get notified about motion via Telegram (with picture or video), Webhook, Alexa or web push. Set them up in the settings.

### API

camera.ui has a REST API. Open `http://localhost:8081/swagger` to see it.

## Recommended camera settings

Set these in the camera's own settings page:

- **Main stream**: H.264, 1920x1080, about 2 Mbit/s variable bitrate, 25 fps
- **Substream**: H.264, about 640x360, 15 to 25 fps (used by Camview with 6 or more cameras)
- **Keyframe interval**: 2 to 4 seconds (for example 50 to 100 at 25 fps)
- **Audio**: AAC, if you want audio

## For developers

Building camera.ui or the Windows installer from source is described in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT License. Copyright (c) 2020-2022 seydx. Based on [camera.ui](https://github.com/SeydX/camera.ui) by seydx.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
