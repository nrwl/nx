import {
  existsSync,
  readJson,
  readJsonSync,
  unlinkSync,
  writeJson,
} from 'fs-extra';
import { join } from 'path';
import { DAEMON_DIR_FOR_CURRENT_WORKSPACE } from './tmp-dir';

export interface DaemonProcessJson {
  processId: number;
}

export const serverProcessJsonPath = join(
  DAEMON_DIR_FOR_CURRENT_WORKSPACE,
  'server-process.json'
);

export async function readDaemonProcessJsonCache(): Promise<DaemonProcessJson | null> {
  if (!existsSync(serverProcessJsonPath)) {
    return null;
  }
  return await readJson(serverProcessJsonPath);
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
  await writeJson(serverProcessJsonPath, daemonJson);
}

export async function safelyCleanUpExistingProcess(): Promise<void> {
  const daemonProcessJson = await readDaemonProcessJsonCache();
  if (daemonProcessJson && daemonProcessJson.processId) {
    try {
      process.kill(daemonProcessJson.processId);
      // we wait for the process to actually shut down before returning
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
    } catch {}
  }
  deleteDaemonJsonProcessCache();
}

// Must be sync for the help output use case
export function getDaemonProcessIdSync(): number | null {
  if (!existsSync(serverProcessJsonPath)) {
    return null;
  }
  try {
    const daemonProcessJson = readJsonSync(serverProcessJsonPath);
    return daemonProcessJson.processId;
  } catch {
    return null;
  }
}
