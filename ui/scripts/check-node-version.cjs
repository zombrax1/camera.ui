const supportedMajor = 22;
const nodeVersion = process.versions.node;
const major = Number.parseInt(nodeVersion.split('.')[0], 10);

if (major !== supportedMajor) {
  console.error(`camera.ui UI build requires Node.js ${supportedMajor} LTS. Detected Node.js ${nodeVersion}.`);
  console.error('Node.js 24 currently breaks this Vue CLI/Webpack build with a neo-async "Callback was already called" error.');
  console.error('Install Node.js 22 LTS, reinstall dependencies, then rerun npm run build.');
  process.exit(1);
}
