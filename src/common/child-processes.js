'use-strict';

import { spawn as spawnProcess } from 'child_process';

// Child processes (ffmpeg) don't end with their parent on Windows. Leftovers keep files in the
// install directory busy, so the installer can't update the app.
const processes = new Set();

export const spawn = (...arguments_) => {
  const cp = spawnProcess(...arguments_);

  processes.add(cp);

  const forget = () => processes.delete(cp);
  cp.once('exit', forget);
  cp.once('error', forget);

  return cp;
};

export const killAllProcesses = () => {
  for (const cp of processes) {
    try {
      cp.kill('SIGKILL');
    } catch {
      // already gone
    }
  }

  processes.clear();
};
