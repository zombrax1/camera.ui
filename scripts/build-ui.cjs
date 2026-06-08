const { spawnSync } = require('child_process');

const legacyOpenSslOption = '--openssl-legacy-provider';
const existingNodeOptions = process.env.NODE_OPTIONS || '';
const nodeOptions = existingNodeOptions.includes(legacyOpenSslOption)
  ? existingNodeOptions
  : `${existingNodeOptions} ${legacyOpenSslOption}`.trim();
const npmCliPath = process.env.npm_execpath;

const isWindows = process.platform === 'win32';
const command = npmCliPath ? process.execPath : 'npm';
const args = npmCliPath ? [npmCliPath, 'run', 'build', '--prefix', 'ui'] : ['run', 'build', '--prefix', 'ui'];
const result = spawnSync(command, args, {
  env: {
    ...process.env,
    NODE_OPTIONS: nodeOptions,
  },
  shell: isWindows && !npmCliPath,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
