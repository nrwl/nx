import { logger } from '@nrwl/devkit';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { spawn, spawnSync } from 'child_process';
import { ensureFileSync, existsSync, readJson, writeJson } from 'fs-extra';
import { join } from 'path';
import { dirSync } from 'tmp';
import { DaemonJson, daemonJsonPath } from '../cache';
import { isServerAvailable } from '../server';

export async function startInBackground(): Promise<void> {
  /**
   * For now, while the daemon is an opt-in feature, we will log to stdout when
   * starting the server, as well as providing a reference to where any subsequent
   * log files can be found.
   */
  const tmpDirPrefix = `nx-daemon--${appRootPath.replace(/\//g, '-')}`;
  const serverLogOutputDir = dirSync({
    prefix: tmpDirPrefix,
  }).name;
  const serverLogOutputFile = join(serverLogOutputDir, 'nx-daemon.log');
  ensureFileSync(serverLogOutputFile);

  // Clean up any existing orphaned background process before creating a new one
  if (existsSync(daemonJsonPath)) {
    const daemonJson: DaemonJson = await readJson(daemonJsonPath);
    if (daemonJson?.backgroundProcessId) {
      process.kill(daemonJson?.backgroundProcessId);
    }
  }

  logger.info(`NX Daemon Server - Starting in a background process...`);
  logger.log(
    `  Logs from the Daemon process can be found here: ${serverLogOutputFile}\n`
  );

  const backgroundProcess = spawn('node', ['./start.js', serverLogOutputFile], {
    cwd: __dirname,
    stdio: 'inherit',
    detached: true,
  });
  backgroundProcess.unref();

  // Persist metadata about the background process so that it can be cleaned up later if needed
  const daemonJson: DaemonJson = {
    backgroundProcessId: backgroundProcess.pid,
    serverLogOutputFile: serverLogOutputFile,
  };
  await writeJson(daemonJsonPath, daemonJson);

  /**
   * Ensure the server is actually available to connect to via IPC before resolving
   */
  return new Promise((resolve) => {
    const id = setInterval(() => {
      if (isServerAvailable()) {
        clearInterval(id);
        resolve();
      }
    }, 500);
  });
}

export function startInCurrentProcess(): void {
  logger.info(`NX Daemon Server - Starting in the current process...`);

  spawnSync('node', ['./start.js'], {
    cwd: __dirname,
    stdio: 'inherit',
  });
}

export function stop(): void {
  logger.info(`NX Daemon Server - Stopping...`);

  spawnSync('node', ['./stop.js'], {
    cwd: __dirname,
    stdio: 'inherit',
  });
}
