const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootPath = path.resolve(__dirname, '..');
const cachePath = path.resolve(rootPath, '.electron-builder-cache');
const electronCachePath = path.resolve(cachePath, 'electron');
const builderCachePath = path.resolve(cachePath, 'builder');
const localAppDataPath = path.resolve(cachePath, 'local-app-data');
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

const result = spawnSync(process.execPath, [builderCommand, ...builderArgs], {
  cwd: rootPath,
  env: {
    ...process.env,
    ELECTRON_CACHE: electronCachePath,
    ELECTRON_BUILDER_CACHE: builderCachePath,
    electron_config_cache: electronCachePath,
    LOCALAPPDATA: localAppDataPath,
  },
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
