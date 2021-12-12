import { existsSync, readJson, unlinkSync, writeJson } from 'fs-extra';
import { join } from 'path';
import { DAEMON_DIR_FOR_CURRENT_WORKSPACE } from './tmp-dir';

export interface DaemonProcessJson {
  processId: number;
}

const serverProcessJsonPath = join(
  DAEMON_DIR_FOR_CURRENT_WORKSPACE,
  'server-process.json'
);

async function readDaemonProcessJsonCache(): Promise<DaemonProcessJson | null> {
  if (!existsSync(serverProcessJsonPath)) {
    return null;
  }
  return await readJson(serverProcessJsonPath);
}

function deleteDaemonJsonProcessCache(): void {
  try {
    unlinkSync(serverProcessJsonPath);
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
    } catch {}
  }
  deleteDaemonJsonProcessCache();
}

// Must be sync for the help output use case
export function getDaemonProcessId(): number | null {
  if (!existsSync(serverProcessJsonPath)) {
    return null;
  }
  try {
    const daemonProcessJson = require(serverProcessJsonPath);
    return daemonProcessJson.processId;
  } catch {
    return null;
  }
}
