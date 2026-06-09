const { app, BrowserWindow, dialog, shell } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const { pathToFileURL } = require('url');

const packageJson = require('../package.json');

let mainWindow = null;
let cameraUi = null;
let isClosing = false;
const CAMERA_UI_START_TIMEOUT_MS = 90_000;

const appCredit = 'Crafted by ZomBrox';
const resolveAppRoot = () => (app.isPackaged ? path.join(process.resourcesPath, 'app') : path.resolve(__dirname, '..'));
const ffmpegBinaryName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';

const escapeHtml = (value = '') =>
  String(value).replace(/["&'<>]/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case String.fromCodePoint(39):
        return '&#39;';
      default:
        return character;
    }
  });

const createStartupHtml = ({ title, message, detail = '', state = 'loading' }) => {
  const isError = state === 'error';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <title>${escapeHtml(title)}</title>
  <style>
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      background: #101418;
      color: #f4f7fb;
      font-family: "Segoe UI", Arial, sans-serif;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    main {
      width: min(520px, calc(100% - 48px));
      text-align: center;
    }
    .mark {
      width: 48px;
      height: 48px;
      margin: 0 auto 22px;
      border-radius: 50%;
      border: 4px solid ${isError ? '#ff6b6b' : 'rgba(255,255,255,0.24)'};
      border-top-color: ${isError ? '#ff6b6b' : '#5cc8ff'};
      ${isError ? '' : 'animation: spin 900ms linear infinite;'}
    }
    h1 {
      margin: 0 0 10px;
      font-size: 25px;
      font-weight: 600;
      letter-spacing: 0;
    }
    p {
      margin: 0;
      color: #b7c0ca;
      font-size: 15px;
      line-height: 1.5;
    }
    .credit {
      margin-top: 18px;
      color: #7f8b98;
      font-size: 12px;
      letter-spacing: 0;
    }
    pre {
      margin: 22px 0 0;
      padding: 14px;
      max-height: 260px;
      overflow: auto;
      text-align: left;
      color: #f8d7da;
      background: rgba(255,255,255,0.08);
      border-radius: 6px;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 12px;
      line-height: 1.45;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <main>
    <div class="mark"></div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    ${detail ? `<pre>${escapeHtml(detail)}</pre>` : ''}
    <p class="credit">${escapeHtml(appCredit)}</p>
  </main>
</body>
</html>`;
};

const isIgnorableNavigationError = (error) =>
  error?.code === 'ERR_ABORTED' || error?.errno === -3 || String(error?.message || '').includes('ERR_ABORTED');

const loadStartupPage = async (content) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  try {
    await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(createStartupHtml(content))}`);
  } catch (error) {
    if (!isIgnorableNavigationError(error)) {
      console.warn('Unable to render camera.ui startup page:', error);
    }
  }
};

const resolveBundledFfmpegPath = (appRoot) => {
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, 'ffmpeg', ffmpegBinaryName),
        path.join(appRoot, 'node_modules', 'ffmpeg-for-homebridge', ffmpegBinaryName),
      ]
    : [path.join(appRoot, 'node_modules', 'ffmpeg-for-homebridge', ffmpegBinaryName)];

  return candidates.find((candidate) => fs.pathExistsSync(candidate));
};

const normalizeFilePath = (value = '') => path.normalize(String(value)).toLowerCase();

const pathExists = (value) => {
  if (!value) {
    return false;
  }

  try {
    return fs.pathExistsSync(value);
  } catch {
    return false;
  }
};

const isPackagedFfmpegPath = (videoProcessor = '', appRoot) => {
  if (!videoProcessor) {
    return false;
  }

  const normalizedVideoProcessor = normalizeFilePath(videoProcessor);
  const normalizedRoots = [appRoot, app.isPackaged ? process.resourcesPath : null]
    .filter(Boolean)
    .map((root) => normalizeFilePath(root));
  const oldBundledModulePath = `${path.sep}ffmpeg-for-homebridge${path.sep}`.toLowerCase();

  return (
    normalizedVideoProcessor.includes(oldBundledModulePath) ||
    normalizedRoots.some((root) => normalizedVideoProcessor.startsWith(root))
  );
};

const configureVideoProcessor = (appRoot, configJson = {}) => {
  const configuredVideoProcessor = configJson?.options?.videoProcessor;
  const bundledFfmpegPath = resolveBundledFfmpegPath(appRoot);

  if (bundledFfmpegPath) {
    process.env.CUI_FFMPEG_PATH = bundledFfmpegPath;

    if (
      !pathExists(configuredVideoProcessor) ||
      (app.isPackaged && isPackagedFfmpegPath(configuredVideoProcessor, appRoot))
    ) {
      configJson.options = configJson.options || {};
      configJson.options.videoProcessor = bundledFfmpegPath;
    }

    return;
  }

  if (!configuredVideoProcessor && app.isPackaged) {
    throw new Error(
      `Bundled FFmpeg was not found. Expected ${path.join(
        process.resourcesPath,
        'ffmpeg',
        ffmpegBinaryName
      )}. Reinstall camera.ui or check whether Windows security software removed ffmpeg.exe.`
    );
  }
};

const setCameraUiEnvironment = (appRoot, storagePath) => {
  process.env.NTBA_FIX_319 = '1';
  process.env.NTBA_FIX_350 = '1';

  process.env.CUI_SERVICE_MODE = '2';
  process.env.CUI_LOG_COLOR = '0';
  process.env.CUI_LOG_MODE = '1';
  process.env.CUI_LOG_TIMESTAMPS = '1';

  process.env.CUI_BASE_PATH = appRoot;
  process.env.CUI_STORAGE_PATH = storagePath;
  process.env.CUI_STORAGE_CONFIG_FILE = path.resolve(storagePath, 'config.json');
  process.env.CUI_STORAGE_DATABASE_PATH = path.resolve(storagePath, 'database');
  process.env.CUI_STORAGE_DATABASE_USER_PATH = path.resolve(storagePath, 'database', 'user');
  process.env.CUI_STORAGE_DATABASE_FILE = path.resolve(storagePath, 'database', 'database.json');
  process.env.CUI_STORAGE_LOG_PATH = path.resolve(storagePath, 'logs');
  process.env.CUI_STORAGE_LOG_FILE = path.resolve(storagePath, 'logs', 'camera.ui.log');
  process.env.CUI_STORAGE_RECORDINGS_PATH = path.resolve(storagePath, 'recordings');
  process.env.CUI_STORAGE_REPORTS_PATH = path.resolve(storagePath, 'reports');

  process.env.CUI_MODULE_NAME = 'camera.ui';
  process.env.CUI_MODULE_VERSION = packageJson.version;
  process.env.CUI_MODULE_GLOBAL = '0';
  process.env.CUI_MODULE_SUDO = '0';
  process.env.CUI_DESKTOP_APP = '1';
  process.env.CUI_DESKTOP_PACKAGED = app.isPackaged ? '1' : '0';
  process.env.CUI_VERSION = packageJson.version;
};

const ensureStorage = async (storagePath) => {
  await Promise.all([
    fs.ensureDir(storagePath),
    fs.ensureDir(path.resolve(storagePath, 'database')),
    fs.ensureDir(path.resolve(storagePath, 'database', 'user')),
    fs.ensureDir(path.resolve(storagePath, 'logs')),
    fs.ensureDir(path.resolve(storagePath, 'recordings')),
    fs.ensureDir(path.resolve(storagePath, 'reports')),
  ]);
};

const importFromApp = async (appRoot, relativePath) => import(pathToFileURL(path.resolve(appRoot, relativePath)).href);

const startCameraUi = async () => {
  const appRoot = resolveAppRoot();
  const storagePath = app.getPath('userData');

  await ensureStorage(storagePath);
  setCameraUiEnvironment(appRoot, storagePath);

  const configJson = fs.readJSONSync(process.env.CUI_STORAGE_CONFIG_FILE, { throws: false }) || {};
  configureVideoProcessor(appRoot, configJson);

  const [{ default: LoggerService }, { default: ConfigService }, { default: Interface }] = await Promise.all([
    importFromApp(appRoot, 'src/services/logger/logger.service.js'),
    importFromApp(appRoot, 'src/services/config/config.service.js'),
    importFromApp(appRoot, 'src/main.js'),
  ]);

  const logger = new LoggerService();
  const config = new ConfigService(configJson);
  cameraUi = new Interface(logger, config);

  const launched = new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, CAMERA_UI_START_TIMEOUT_MS);

    cameraUi.once('finishLaunching', () => {
      clearTimeout(timeout);
      resolve(true);
    });
  });

  const startPromise = cameraUi.start();
  const didLaunch = await Promise.race([launched, startPromise.then(() => true)]);

  if (!didLaunch) {
    startPromise.catch(() => {});
    throw new Error(`camera.ui did not start on port ${config.ui.port} within 90 seconds.`);
  }

  await startPromise;

  return config.ui.port;
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    title: 'camera.ui',
    backgroundColor: '#111111',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.removeMenu();
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

const loadApplication = async (port) => {
  try {
    await mainWindow.loadURL(`http://127.0.0.1:${port}`);
  } catch (error) {
    if (!isIgnorableNavigationError(error)) {
      throw error;
    }
  }
};

const shutdownCameraUi = async () => {
  if (!cameraUi) {
    return;
  }

  await cameraUi.close();
  cameraUi = null;
};

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.setName('camera.ui');

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }

      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    createWindow();
    await loadStartupPage({
      title: 'Starting camera.ui',
      message: 'Loading the camera server. This can take a few seconds after install.',
    });

    try {
      const port = await startCameraUi();
      await loadStartupPage({
        title: 'Opening camera.ui',
        message: `Connecting to local server on port ${port}.`,
      });
      await loadApplication(port);
    } catch (error) {
      console.error(error);
      await loadStartupPage({
        title: 'camera.ui failed to start',
        message: 'Startup stopped before the camera server was ready.',
        detail: error?.stack || String(error),
        state: 'error',
      });
      dialog.showErrorBox('camera.ui failed to start', error?.message || String(error));
    }
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  app.on('before-quit', (event) => {
    if (isClosing || !cameraUi) {
      return;
    }

    event.preventDefault();
    isClosing = true;

    shutdownCameraUi()
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        app.exit(0);
      });
  });
}
