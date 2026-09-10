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
  const daemonJson = readDaemonRegistrationSync();
  if (!daemonJson) {
    return null;
  }
  // A daemon on another version cannot serve this client, and the caller has to
  // hear about it rather than read it as "no daemon registered".
  if (daemonJson.nxVersion !== nxVersion) {
    clientLogger.log(
      `[Cache] Version mismatch: daemon=${daemonJson.nxVersion}, client=${nxVersion}`
    );
    throw new VersionMismatchError();
  }
  return daemonJson;
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

/**
 * The registration exactly as written, with no version check and no throw.
 *
 * readDaemonProcessJsonCache() cannot serve a caller that only wants to know
 * who is registered: it raises VersionMismatchError, and the daemon start path
 * deciding whether to stand down must not take a throw.
 */
export function readDaemonRegistrationSync(): DaemonProcessJson | null {
  if (!existsSync(serverProcessJsonPath)) {
    return null;
  }
  try {
    return readJsonFile(serverProcessJsonPath);
  } catch {
    return null;
  }
}

// Must be sync for the help output use case
export function getDaemonProcessIdSync(): number | null {
  return readDaemonRegistrationSync()?.processId ?? null;
}
