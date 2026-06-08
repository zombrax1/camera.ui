> [!NOTE]
> This repository includes easier ONVIF and IPC camera discovery.
>
> Install this repository from source to use those features.

<p align="center">
    <img src="https://github.com/SeydX/camera.ui/blob/master/images/logo.png">
</p>

# camera.ui

[![GitHub release](https://img.shields.io/github/v/release/zombrax1/camera.ui?style=flat-square)](https://github.com/zombrax1/camera.ui/releases)
[![GitHub last commit](https://img.shields.io/github/last-commit/zombrax1/camera.ui.svg?style=flat-square)](https://github.com/zombrax1/camera.ui)
[![Donate](https://img.shields.io/badge/Donate-PayPal-blue.svg?style=flat-square&maxAge=2592000)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=NP4T3KASWQLD8)

**camera.ui** is an NVR-like PWA to control your RTSP capable cameras with:

- **Live Streams** on Web
- **Camview**: A resizable, drag & drop camera overview
- **Web Application** with almost full PWA support like push notification and more
- **Multi-language**: Easily expandable multi-language support
- **Motion Detection** via video analysis, MQTT, FTP, SMT or HTTP.
- **Image Rekognition** via AWS Rekognition
- **Notifications** via Alexa, Telegram, Webhook and WebPush
- **Snapshot/Video**: Save recording of snapshots/videos locally when motion is detected
- **Prebuffering:** See the seconds before the movement event
- **User Interface**: Beautiful and with love designed interface with 8 different color themes, darkmode and more
- **HomeKit**: Easily expose the cameras to Apple Home with HSV support

and much more...

## What This Repository Adds

This repository adds an NVR-style camera onboarding flow for mixed ONVIF and RTSP/IP camera networks:

- **ONVIF Search**: Scan common ONVIF ports such as `8888`, `5000`, `8080`, and `80` on the local network.
- **ONVIF Authentication**: Enter ONVIF credentials for devices that require authentication before stream profiles can be read.
- **RTSP Testing**: Probe discovered ONVIF streams and common RTSP paths before adding a camera.
- **IPC Camera Mode**: Add an IP camera manually by entering camera name, IP address, RTSP port, username, and password.
- **Preview Thumbnail**: Show a small RTSP thumbnail when the tested stream can return a frame.
- **Existing IP Highlighting**: Mark discovered or manually entered IP addresses that already exist in the camera list.

**Supported Languages:**

:de: | :gb: | :netherlands: | :fr: | :thailand: | :es:

**Demo:** https://streamable.com/3yce42

## Requirements

Install these before installing this repository:

- **Node.js 22 LTS** with `npm`
- **Git**
- **PowerShell** on Windows, or a normal terminal on Linux/macOS
- **Network access to your cameras** from the machine running camera.ui
- **Port `8081` free** on the machine running camera.ui

Do not use Node.js 24 for this repository. The current Vue CLI/Webpack UI build fails on Node.js 24 with a `neo-async` / `Callback was already called` error.

On Windows, clone this repository into a normal user folder such as `C:\camera.ui` or `C:\Users\<you>\Documents\camera.ui`. Do not install it under `C:\Windows\System32`.

For camera discovery, make sure the computer and cameras are on the same LAN. Some cameras also require ONVIF to be enabled in the camera's own settings page.

## Install On A Windows PC

For a normal camera PC, use the Windows installer. Do not install Node.js, do not run `npm`, and do not build from source on that PC.

1. Open this repository on GitHub.
2. Go to **Actions -> Build Windows Installer**.
3. Open the latest successful run.
4. Download the **camera-ui-windows-installer** artifact.
5. Extract the downloaded artifact zip.
6. Run `camera.ui Setup <version>.exe`.
7. Launch **camera.ui** from the desktop shortcut or Start Menu.

The installer includes the desktop runtime, camera.ui server, built web interface, and ffmpeg. The target PC only needs Windows, network access to the cameras, and port `8081` free.

The installer is large because it bundles the desktop runtime and ffmpeg so the target PC does not need Node.js or command-line build tools. GitHub does not accept normal git source files over 100 MB, so the `.exe` is published as a GitHub Actions artifact instead of being committed into the repository.

## Install This Repository From Source

The public `camera.ui` npm package belongs to the upstream project. To use the ONVIF/IPC discovery features here, install from this repository.

### 1. Download The Source

```powershell
git clone https://github.com/zombrax1/camera.ui.git
cd camera.ui
```

### 2. Install Dependencies

```powershell
npm install
npm install --legacy-peer-deps --prefix ui
```

### 3. Build The Web Interface

On Windows PowerShell:

```powershell
npm run build
```

On Linux/macOS:

```bash
npm run build
```

The build writes the production web app into `interface/`. If the build does not finish, the backend can still start, but the browser will show `Cannot GET /`.

### 4. Start camera.ui

On Windows PowerShell:

```powershell
node .\bin\camera.ui.js
```

On Linux/macOS:

```bash
node ./bin/camera.ui.js
```

Then open:

```text
http://localhost:8081
```

Leave the terminal window open while camera.ui is running. Press `Ctrl+C` in that terminal to stop it.

## First Login

- Username: `master`
- Password: `master`

After the first login, change the account password from the account settings page.

## Add Your First Camera

Open `Settings -> Cameras -> Find / Add Camera`.

Use **ONVIF Search** when the camera supports ONVIF. Enter the username and password if needed. Many cameras use username `admin` with an empty password, but some require their own ONVIF account.

Use **IPC Camera** when you know the camera IP and RTSP port. Enter the camera name, IP address, RTSP port, username, and password. If the camera has no password, leave the password empty. Click **Test RTSP** first, then add the camera when the stream test succeeds.

Discovered cameras that are already in your list are highlighted so you do not add the same IP twice. A small thumbnail appears when the RTSP test can read a frame from the camera.

## Build A Windows Installer

To make a normal Windows `.exe` installer:

```powershell
npm install
npm install --legacy-peer-deps --prefix ui
npm run dist:win
```

The installer is created in `dist\camera.ui Setup <version>.exe`.

After installing, launch **camera.ui** from the desktop shortcut or Start Menu. The desktop app starts the camera.ui server internally and opens the interface in its own window, so the target PC does not need Node.js or command-line setup. App data, config, logs, recordings, and reports are stored under `%APPDATA%\camera.ui`.

## Update An Existing Install

On Windows PowerShell:

```powershell
git pull
npm install
npm install --legacy-peer-deps --prefix ui
npm run build
node .\bin\camera.ui.js
```

On Linux/macOS:

```bash
git pull
npm install
npm install --legacy-peer-deps --prefix ui
npm run build
node ./bin/camera.ui.js
```

## Troubleshooting Install Problems

- **Build error `Callback was already called` or `neo-async` on Node.js 24**: Install Node.js 22 LTS, then rerun `npm install`, `npm install --legacy-peer-deps --prefix ui`, and `npm run build`.
- **Build error `ERR_OSSL_EVP_UNSUPPORTED`**: Run `npm run build`; the root build script sets `NODE_OPTIONS=--openssl-legacy-provider` automatically.
- **Browser shows `Cannot GET /` at `http://localhost:8081`**: The backend is running but the UI build is missing. Run `npm run build`, confirm `interface/index.html` exists, then restart `node .\bin\camera.ui.js`.
- **`http://localhost:8081` does not open**: Check that camera.ui is still running and that port `8081` is not already used by another app.
- **Camera is detected but shows offline**: The IP may be correct while the RTSP path, RTSP port, username, or password is wrong. Use **IPC Camera** and **Test RTSP** to try the correct stream settings.
- **ONVIF search does not find a camera**: Enable ONVIF in the camera settings, confirm the camera is on the same LAN, then try common ONVIF ports such as `8888`, `5000`, `8080`, and `80`.

## Documentation

- [camera.ui](#cameraui)
  - [What This Repository Adds](#what-this-repository-adds)
  - [Requirements](#requirements)
  - [Install This Repository](#install-this-repository)
    - [1. Download The Source](#1-download-the-source)
    - [2. Install Dependencies](#2-install-dependencies)
    - [3. Build The Web Interface](#3-build-the-web-interface)
    - [4. Start camera.ui](#4-start-cameraui)
  - [First Login](#first-login)
  - [Add Your First Camera](#add-your-first-camera)
  - [Update An Existing Install](#update-an-existing-install)
  - [Troubleshooting Install Problems](#troubleshooting-install-problems)
  - [Documentation](#documentation)
  - [Configuration](#configuration)
  - [Defaults](#defaults)
  - [Usage](#usage)
    - [Dashboard](#dashboard)
    - [Cameras](#cameras)
    - [Camera](#camera)
    - [Recordings](#recordings)
    - [Notifications](#notifications)
    - [Camview](#camview)
    - [Log](#log)
    - [Config](#config)
    - [Utilization](#utilization)
    - [Settings](#settings)
  - [HomeKit](#homekit)
  - [Motion detection](#motion-detection)
    - [Videoanalysis](#videoanalysis)
    - [HTTP](#http)
    - [MQTT](#mqtt)
    - [SMTP](#smtp)
    - [FTP](#ftp)
  - [Image Rekognition](#image-rekognition)
  - [Notifications](#notifications-1)
  - [PWA](#pwa)
  - [Service Mode](#service-mode)
  - [Supported clients](#supported-clients)
    - [Browser](#browser)
  - [Supported Cameras](#supported-cameras)
    - [Camera Settings](#camera-settings)
  - [API](#api)
  - [FAQ](#faq)
  - [Contributing](#contributing)
  - [Troubleshooting](#troubleshooting)
  - [Wiki](#wiki)
  - [License](#license)
    - [MIT License](#mit-license)

## Configuration

camera.ui installs itself in the user directory under `~/.camera.ui`.

The database, recordings as well as config.json are stored locally in this folder and are never accessible to others. The settings can be changed directly with the help of an editor, or directly via the interface.

After the installation you can start camera.ui with the following command in the terminal

```
camera.ui
```

`-D, --debug`: Turn on debug level logging

`-C, --no-color`: Disable color in logging

`-T, --no-timestamp`: Do not issue timestamps in logging

`--no-sudo`: Disable sudo for updating through ui

`--no-global`: Disable global (-g) prefix for updating through ui

`-S, --storage-path`: Look for camera.ui files at [path] instead of the default location (~/.camera.ui)'

## Defaults

Once you have installed and configured it you can access the interface via http://localhost:8081.

The default username is ``master`` and the default password is ``master``. When you log in for the first time, camera.ui will ask you to change your username and password.

## Usage

### Dashboard

The Dashboard is the main page of the interface and offers a variety of widgets to customize it as you like. The widgets will expand over time. At the moment the following widgets are available for the dashboard:  Time, Weather, Uptime, Camera, Notifications, RSS Feed, Status, Charts (CPU Load, CPU Temperature, Memory Load), Shortcuts and Log

<img src="https://github.com/SeydX/camera.ui/blob/master/images/browser/dashboard.png" align="center" alt="camera.ui">

### Cameras

Here are all cameras listed by room and show the current snapshot as a cover sheet

<img src="https://github.com/SeydX/camera.ui/blob/master/images/browser/cameras.png" align="center" alt="camera.ui">

### Camera

If you select a camera you can watch the livestream directly in the browser. With the camera.ui player you can pause the stream, turn audio on/off or reload the stream.

<img src="https://github.com/SeydX/camera.ui/blob/master/images/browser/camera.png" align="center" alt="camera.ui">

### Recordings

All images or videos recorded by motion are listed here. If AWS Rekognition is used, the label for the recording is also displayed, as well as the date and time. Using the filter function, the recordings can be filtered as desired

<img src="https://github.com/SeydX/camera.ui/blob/master/images/browser/recordings.png" align="center" alt="camera.ui">

### Notifications

All motion events as well as system messages can be viewed here. Each notification has one or more labels to better catagorize them. The filter function can also be used to filter the notifications as desired.

<img src="https://github.com/SeydX/camera.ui/blob/master/images/browser/notifications.png" align="center" alt="camera.ui">

### Camview

Camview displays all camera streams in tiles, hiding everything unnecessary. Camview is great for giving a direct insight into the cameras. Also here the streams can be paused by the camera.ui video player, audio can be switched on/off, streams can be reloaded or viewed in full mode.

<img src="https://github.com/SeydX/camera.ui/blob/master/images/browser/camview.png" align="center" alt="camera.ui">

### Log

All events that occur in the backend can be monitored via the built-in log. In addition, the log can be also be cleared or downloaded here.

<img src="https://github.com/SeydX/camera.ui/blob/master/images/browser/console.png" align="center" alt="camera.ui">

### Config

Using the built-in editor you can easily edit your config.json. In addition, any errors are immediately displayed and thus avoided to save a faulty config.json

<img src="https://github.com/SeydX/camera.ui/blob/master/images/browser/config.png" align="center" alt="camera.ui">

### Utilization

"Utilization" shows you a graphical overview of the system utilization.  Here you can see in real time how high the CPU utilization is, how high the CPU temperature is and how much memory is still free.

<img src="https://github.com/SeydX/camera.ui/blob/master/images/browser/utilization.png" align="center" alt="camera.ui">

### Settings

On the settings page you can make ALL settings regarding your config.json and database. All parameters defined in config.json are directly configurable from this page. If camera.ui runs via "Homebridge" you can also set Homebridge relevant parameters here.

<img src="https://github.com/SeydX/camera.ui/blob/master/images/browser/settings.png" align="center" alt="camera.ui">

## HomeKit

The cameras that are included in camera.ui can easily be exposed to Apple Home via Homebridge.

To do this, please install [homebridge-config-ui-x](https://github.com/oznu/homebridge-config-ui-x) and search for the plugin [homebridge-camera-ui](https://github.com/seydx/homebridge-camera-ui) and install it.

<img src="https://github.com/SeydX/camera.ui/blob/master/images/homebridge/homebridge_search.png" align="center" alt="camera.ui">

If you run camera.ui via Homebridge, then the interface will also be started automatically on every startup. An additional `Service Mode` is no longer needed.

If you have used camera.ui before WITHOUT Homebridge and then use it with Homebridge, then the database must be recreated and also the config is taken over by Homebridge. You have to add the cameras again to Homebridge. After restarting Homebridge, the cameras will be also available on camera.ui

Homebridge-config-ui-x offers some more config parameter to eg. enable HSV, motion sensors, motion switches and more. Please take a look at the `example-config.json`


*Note:* homebridge-camera-ui >= v5.0.0 is compatible with camera.ui.

## Motion detection

camera.ui offers a variety of options to detect and process motion.

### Videoanalysis

<img src="https://github.com/SeydX/camera.ui/blob/master/images/browser/videoanalysis.png" align="center" alt="camera.ui">

With this option camera.ui connects to the stream and compares frame by frame if there are changes. The zones and sensitivity can be set in the interface.

### HTTP

If the HTTP server is enabled for motion detection, calling the link can easily trigger motion.

Example:

`http://localhost:8123/motion?My+Camera`


### MQTT

If you have set up the MQTT client (Settings > System > MQTT), you can set the required parameters such as "Motion Topic", "Message" etc. via the interface (Settings > Cameras > MQTT).

**Motion Topic**: The MQTT topic to watch for motion alerts. The topic (prefix/suffix) should be unique, it will be used to assign the motion detected message to the desired camera.

**Motion Message**: The message to watch for to trigger motion alerts.

The message can be a simple "string" (e.g. "ON"/"OFF) or a JSON object. If the MQTT message is a JSON object like:

```json
{
  "id": "test",
  "event": {
    "time": 1234567890,
    "state": true,
  }
}
```

Then define the exact parameter under "Motion Message" so that camera.ui can read from it, eg:

```json
"motionMessage": {
  "event": {
    "state": true
  }
}
```

### SMTP

If the SMTP server is turned on and your camera is able to send an email when motion is detected, you can easily trigger motion through it, eg:

`From: My+Camera@camera.ui`
`To: My+Camera@camera.ui`

Please note that the camera.ui SMTP server is set in the camera settings (ip/port).

### FTP

If your camera is able to upload an image when motion is detected, then you can select the camera.ui FTP server as the destination. Very important here is. The path you enter via the camera's own settings page must be the camera name as defined in config.

Every time the camera tries to connect to the server, the camera.ui detects and takes the entered path to determine the camera.

## Image Rekognition

camera.ui also uses image rekognition with Amazon Web Services to analyse, detect, remember and recognize objects, scenes, and faces in images. You can enable for each camera the image rekogniton and you can even set labels for each camera. For each object, scene, and concept the API returns one or more labels. Each label provides the object name. For example, suppose the input image has a lighthouse, the sea, and a rock. The response includes all three labels, one for each object.

This makes it possible to analyze every movement before this is stored or sent as a notification.

To use image rekognition, you need to set up a AWS account with an IAM user. More Infos: [AWS Image Rekognition](https://aws.amazon.com/rekognition/?nc1=h_ls&blog-cards.sort-by=item.additionalFields.createdDate&blog-cards.sort-order=desc)

## Notifications

camera.ui supports numerous notification options. Each of them can be conveniently set via the interface.

Since push notifications only work conditionally for websites (see PWA), you can easily work around this via third-party providers.

These would be e.g.

- Telegram
- Webhook
- Alexa
- Third party providers that support Alexa

Via Telegram, you even have the option to send picture or video along with text messages.

## PWA

camera.ui is a full-featured PWA (Progressive Web Application). The PWA offers several advantages over a normal web page. Via Windows/macOS/Android the browser can directly send you push notifications natively. The handling of the page becomes much faster and much more.

To "enable" PWA you need to run the page over HTTPS. In the config.json you can provide your own SSL key and certificate to run camera.ui over HTTPS.

## Service Mode

To let camera.ui run permanently in the background, you can use it in `Service Mode`.

Create a new file named `camera.ui.default` and paste the following into it:

```
CAMERA_UI_OPTS=-D -C -T -S "/home/pi/Desktop/.camera.ui/"
CUI_STORAGE_PATH="/home/pi/Desktop/.camera.ui/"

DISABLE_OPENCOLLECTIVE=true
```

Please make sure to change the path if necessary. Put the camera.ui.default file to `/etc/default/` folder


Then create another file named `camera.ui.service` and add the following:

```
[Unit]
Description=camera.ui
After=syslog.target network-online.target

[Service]
Type=simple
User=pi
EnvironmentFile=/etc/default/camera.ui
ExecStart=/home/pi/Desktop/camera.ui/bin/camera.ui.js $CAMERA_UI_OPTS
Restart=always
RestartSec=5
KillMode=process

[Install]
WantedBy=multi-user.target
```

Put the camera.ui.service file into `/etc/systemd/system/` folder.

Type following commands to enable/start the service

1) `sudo systemctl daemon-reload`
2) `sudo systemctl enable camera.ui`
3) `sudo systemctl start camera.ui`

You can always watch the log with following command:

`sudo journalctl -f -u camera.ui`

## Supported clients

This plugin has been verified to work with the following apps/systems:

- iOS
- Android
- Windows 10
- macOS Catalina 10.15
- Node >= 22

### Browser

The following browsers are supported by this plugin:

- Chrome - latest
- Firefox - latest
- Safari - 2 most recent major versions
- iOS - 2 most recent major versions

_MS Internet Explorer (any version) is not supported!_

## Supported Cameras

Every camera with an active RTSP stream!

### Camera Settings

You should make the following configuration for your camera via the camera's own settings page. These settings work best.

* Video: H264 (Others like mjpeg also work, but need to be reencoded and would be of limited use for prebuffering)
* Audio: AAC (Other codecs could also work through reencoding)
* Resolution: Freely selectable, but 1920x1080 works best with Apple HSV 
* 2 Mbit variable bitrate (up to 6Mbit may work)
* 25 FPS (30 FPS prefered). 
* Keyframe interval is 4 seconds. Frame Interval = FPS * 4 => 30 * 4 = 120

## API

camera.ui has a REST API that is primarily used by the web client (i.e. the UI), but can also be consumed by other apps or personal scripts.

You can access the API reference via your local instance by going to /swagger

For example http://[IP]:8081/swagger

## FAQ

Please check our [FAQ](https://github.com/SeydX/camera.ui/wiki/FAQ) before you open an issue.

## Contributing

You can contribute to this in following ways:

- Report issues and help verify fixes as they are checked in.
- Review the source code changes.
- Contribute bug fixes.
- Contribute changes to extend the capabilities
- Pull requests are accepted.

See [CONTRIBUTING](https://github.com/SeydX/camera.ui/blob/master/CONTRIBUTING.md)

## Troubleshooting

If you have any issues then you can run camera.ui in debug mode, which will provide some additional information. This might be useful for debugging issues. Open the interface > settings > system > 

https://github.com/SeydX/camera.ui/wiki/Debug

## Wiki
Before you open a new issue, please read carefully the wiki: https://github.com/seydx/homebridge-camera-ui/wiki

## License

### MIT License

Copyright (c) 2020-2022 seydx

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
