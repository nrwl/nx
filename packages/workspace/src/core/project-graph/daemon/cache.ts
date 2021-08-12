import { existsSync, readJson, unlinkSync, writeJson } from 'fs-extra';
import { join } from 'path';
import { ensureCacheDirectory, nxDepsDir } from '../../nx-deps/nx-deps-cache';

/**
 * Because daemon server utilities will be executed across completely different processes,
 * it is not possible for us to cache valuable metadata in memory. We therefore
 * instead leverage the existing node_modules/.cache/nx directory to create a new
 * file called daemon.json in order to track things such as the background processes
 * created by this utility so that they can be cleaned up appropriately.
 */
export interface DaemonJson {
  serverLogOutputFile: string;
  backgroundProcessId: number;
}

const daemonJsonPath = join(nxDepsDir, 'daemon.json');

export async function readDaemonJsonCache(): Promise<DaemonJson | null> {
  ensureCacheDirectory();
  if (!existsSync(daemonJsonPath)) {
    return null;
  }
  return await readJson(daemonJsonPath);
}

export async function writeDaemonJsonCache(
  daemonJson: DaemonJson
): Promise<void> {
  ensureCacheDirectory();
  await writeJson(daemonJsonPath, daemonJson);
}

export function deleteDaemonJsonCache(): void {
  try {
    unlinkSync(daemonJsonPath);
  } catch {}
}
