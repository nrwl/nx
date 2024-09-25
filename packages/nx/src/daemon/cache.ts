import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'path';
import { DAEMON_DIR_FOR_CURRENT_WORKSPACE } from './tmp-dir';
import { readJsonFile, writeJsonFileAsync } from '../utils/fileutils';

export interface DaemonProcessJson {
  processId: number;
}

export const serverProcessJsonPath = join(
  DAEMON_DIR_FOR_CURRENT_WORKSPACE,
  'server-process.json'
);

export function readDaemonProcessJsonCache(): DaemonProcessJson | null {
  if (!existsSync(serverProcessJsonPath)) {
    return null;
  }
  return readJsonFile(serverProcessJsonPath);
}

export function deleteDaemonJsonProcessCache(): void {
  try {
    if (getDaemonProcessIdSync() === process.pid) {
      unlinkSync(serverProcessJsonPath);
    }
  } catch {}
}

export async function writeDaemonJsonProcessCache(
  daemonJson: DaemonProcessJson
): Promise<void> {
  await writeJsonFileAsync(serverProcessJsonPath, daemonJson, {
    appendNewLine: true,
  });
}

export async function waitForDaemonToExitAndCleanupProcessJson(): Promise<void> {
  const daemonProcessJson = readDaemonProcessJsonCache();
  if (daemonProcessJson && daemonProcessJson.processId) {
    await new Promise<void>((resolve, reject) => {
      let count = 0;
      const interval = setInterval(() => {
        try {
          // sending a signal 0 to a process checks if the process is running instead of actually killing it
          process.kill(daemonProcessJson.processId, 0);
        } catch (e) {
          clearInterval(interval);
          resolve();
        }
        if ((count += 1) > 200) {
          clearInterval(interval);
          reject(
            `Daemon process ${daemonProcessJson.processId} didn't exit after 2 seconds.`
          );
        }
      }, 10);
    });
    deleteDaemonJsonProcessCache();
  }
}

// Must be sync for the help output use case
export function getDaemonProcessIdSync(): number | null {
  if (!existsSync(serverProcessJsonPath)) {
    return null;
  }
  try {
    const daemonProcessJson = readJsonFile(serverProcessJsonPath);
    return daemonProcessJson.processId;
  } catch {
    return null;
  }
}
