const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootPath = path.resolve(__dirname, '..');
const cachePath = path.resolve(rootPath, '.electron-builder-cache');
const electronCachePath = path.resolve(cachePath, 'electron');
const builderCachePath = path.resolve(cachePath, 'builder');
const localAppDataPath = path.resolve(cachePath, 'local-app-data');
const fallbackBinariesMirror = 'https://npmmirror.com/mirrors/electron-builder-binaries/';
const builderCommand = path.resolve(
  rootPath,
  'node_modules',
  'electron-builder',
  'cli.js'
);

fs.mkdirSync(electronCachePath, { recursive: true });
fs.mkdirSync(builderCachePath, { recursive: true });
fs.mkdirSync(localAppDataPath, { recursive: true });

const builderArgs = ['--win', ...process.argv.slice(2)];
const hasPublishArg = builderArgs.some((argument) => argument === '--publish' || argument.startsWith('--publish='));

if (!hasPublishArg) {
  builderArgs.push('--publish', 'never');
}

const createEnv = (overrides = {}) => ({
  ...process.env,
  ELECTRON_CACHE: electronCachePath,
  ELECTRON_BUILDER_CACHE: builderCachePath,
  electron_config_cache: electronCachePath,
  LOCALAPPDATA: localAppDataPath,
  ...overrides,
});

const runBuilder = (envOverrides = {}) => spawnSync(process.execPath, [builderCommand, ...builderArgs], {
  cwd: rootPath,
  env: createEnv(envOverrides),
  stdio: 'inherit',
});

let result = runBuilder();

if (
  (result.status ?? 1) !== 0 &&
  !process.env.ELECTRON_BUILDER_BINARIES_MIRROR &&
  !process.env.ELECTRON_BUILDER_BINARIES_DOWNLOAD_OVERRIDE_URL
) {
  console.warn(`electron-builder failed; retrying with binary mirror ${fallbackBinariesMirror}`);
  result = runBuilder({
    ELECTRON_BUILDER_BINARIES_MIRROR: fallbackBinariesMirror,
  });
}

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
