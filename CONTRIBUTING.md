# Contributing

Pull requests are welcome from everyone.

This project uses Express for the server and VUE for the client interface.

**Credits goes also to:**

- [@oznu](https://github.com/oznu): I could learn a lot from homebridge-config-ui-x
- [@Sunoo](https://github.com/Sunoo): For the HTTP/MQTT/SMTP/FTP implementation
- [@phoboslab](https://github.com/phoboslab/jsmpeg): For the awesome decoder to show camera streams within browser
- [@koush](https://github.com/koush): For the prebuffering process
- [@adumesny](https://github.com/gridstack/gridstack.js): Without Gridstack the dashboard would not be so nice and functional

And also many thanks to the other developers who are not mentioned by name! You rock!

## Translations

Additional language translations, or improvements to existing translations are most welcome. Translations can be found here:

https://github.com/SeydX/homebridge-camera-ui/tree/master/ui/src/i18n

## Building from source

Normal users don't need this: they install the Windows installer from [Releases](https://github.com/zombrax1/camera.ui/releases). This section is for working on the code or building the installer yourself.

### Requirements

- **Node.js 22 LTS** with `npm`. Don't use Node.js 24: the Vue CLI/Webpack build of the UI fails with a `neo-async` / `Callback was already called` error.
- **Git**
- On Windows, clone into a normal user folder such as `C:\camera.ui`, not under `C:\Windows\System32`.

### Run from source

```powershell
git clone https://github.com/zombrax1/camera.ui.git
cd camera.ui
npm install
npm install --legacy-peer-deps --prefix ui
npm run build
node ./bin/camera.ui.js
```

`npm run build` writes the web interface to `interface/`. Without it the server starts, but the browser shows `Cannot GET /`. Then open http://localhost:8081. Data is stored in `~/.camera.ui` (change it with `-S <path>`).

Options for `bin/camera.ui.js`:

- `-L, --log-level <level>`: 1 = Info (default), 2 = Debug, 3 = Warn, 4 = Error
- `-C, --no-color`: no colors in the log
- `-T, --no-timestamp`: no timestamps in the log
- `-S, --storage-path <path>`: use another data folder instead of `~/.camera.ui`

Run the server tests and lint with `npm test` and `npm run lint`.

### Build the Windows installer

```powershell
npm install
npm install --legacy-peer-deps --prefix ui
npm run dist:win
```

The installer is created as `dist\camera.ui Setup <version>.exe`. The GitHub workflows in `.github/workflows` build it the same way; the release workflow publishes it as a GitHub Release asset (installers are too large to commit).

### Build problems

- **`Callback was already called` or `neo-async`**: use Node.js 22 LTS, then run the install and build commands again.
- **`ERR_OSSL_EVP_UNSUPPORTED`**: use `npm run build`, it sets `NODE_OPTIONS=--openssl-legacy-provider` for you.
- **`Cannot GET /` at http://localhost:8081**: the UI build is missing. Run `npm run build`, check that `interface/index.html` exists, and restart the server.
