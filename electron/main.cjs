const { app, BrowserWindow, dialog, shell } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const { pathToFileURL } = require('url');

const packageJson = require('../package.json');

let mainWindow = null;
let cameraUi = null;
let isClosing = false;

const resolveAppRoot = () => (app.isPackaged ? path.join(process.resourcesPath, 'app') : path.resolve(__dirname, '..'));

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

  const [{ default: LoggerService }, { default: ConfigService }, { default: Interface }] = await Promise.all([
    importFromApp(appRoot, 'src/services/logger/logger.service.js'),
    importFromApp(appRoot, 'src/services/config/config.service.js'),
    importFromApp(appRoot, 'src/main.js'),
  ]);

  const logger = new LoggerService();
  const configJson = fs.readJSONSync(process.env.CUI_STORAGE_CONFIG_FILE, { throws: false });
  const config = new ConfigService(configJson);
  cameraUi = new Interface(logger, config);

  const launched = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`camera.ui did not start on port ${config.ui.port} within 30 seconds.`));
    }, 30_000);

    cameraUi.once('finishLaunching', () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  await cameraUi.start();
  await launched;

  return config.ui.port;
};

const createWindow = async (port) => {
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

  await mainWindow.loadURL(`http://127.0.0.1:${port}`);
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
    try {
      const port = await startCameraUi();
      await createWindow(port);
    } catch (error) {
      dialog.showErrorBox('camera.ui failed to start', error?.stack || String(error));
      app.quit();
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
