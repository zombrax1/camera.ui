const { spawnSync } = require('child_process');

const legacyOpenSslOption = '--openssl-legacy-provider';
const existingNodeOptions = process.env.NODE_OPTIONS || '';
const nodeOptions = existingNodeOptions.includes(legacyOpenSslOption)
  ? existingNodeOptions
  : `${existingNodeOptions} ${legacyOpenSslOption}`.trim();

const isWindows = process.platform === 'win32';
const result = spawnSync('npm', ['run', 'build', '--prefix', 'ui'], {
  env: {
    ...process.env,
    NODE_OPTIONS: nodeOptions,
  },
  shell: isWindows,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
