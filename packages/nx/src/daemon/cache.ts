import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'path';
import { DAEMON_DIR_FOR_CURRENT_WORKSPACE } from './tmp-dir';
import { readJsonFile, writeJsonFileAsync } from '../utils/fileutils';
import { nxVersion } from '../utils/versions';
import { clientLogger } from './logger';
import { VersionMismatchError } from './client/daemon-socket-messenger';

export interface DaemonProcessJson {
  processId: number;
  socketPath: string;
  nxVersion: string;
}

export const serverProcessJsonPath = join(
  DAEMON_DIR_FOR_CURRENT_WORKSPACE,
  'server-process.json'
);

export function readDaemonProcessJsonCache(): DaemonProcessJson | null {
  try {
    const daemonJson = readJsonFile(serverProcessJsonPath);
    // If the daemon version doesn't match the client version, throw error
    if (daemonJson.nxVersion !== nxVersion) {
      clientLogger.log(
        `[Cache] Version mismatch: daemon=${daemonJson.nxVersion}, client=${nxVersion}`
      );
      throw new VersionMismatchError();
    }
    return daemonJson;
  } catch (e) {
    if (e instanceof VersionMismatchError) {
      throw e; // Let version mismatch bubble up
    }
    return null;
  }
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
