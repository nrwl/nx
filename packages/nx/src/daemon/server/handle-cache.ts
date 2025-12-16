import type { CachedResult as NativeCacheResult } from '../../native';
import { NxCache } from '../../native';
import { getDbConnection } from '../../utils/db-connection';
import { workspaceRoot } from '../../utils/workspace-root';
import { cacheDir } from '../../utils/cache-directory';
import { readNxJson } from '../../config/nx-json';
import { resolveMaxCacheSize } from '../../tasks-runner/cache';

let cache: NxCache | null = null;

function getCacheInstance(): NxCache {
  if (!cache) {
    const nxJson = readNxJson();
    cache = new NxCache(
      workspaceRoot,
      cacheDir,
      getDbConnection(),
      undefined,
      resolveMaxCacheSize(nxJson)
    );
  }
  return cache;
}

export async function handleCacheGet(hash: string) {
  const result = getCacheInstance().get(hash);
  return {
    response: JSON.stringify(result),
    description: 'handleCacheGet',
  };
}

export async function handleCachePut(
  hash: string,
  terminalOutput: string | null,
  outputs: string[],
  code: number
) {
  getCacheInstance().put(hash, terminalOutput, outputs, code);
  return {
    response: 'true',
    description: 'handleCachePut',
  };
}

export async function handleCacheRemoveOldRecords() {
  getCacheInstance().removeOldCacheRecords();
  return {
    response: 'true',
    description: 'handleCacheRemoveOldRecords',
  };
}

export async function handleCacheApplyRemoteResults(
  hash: string,
  result: NativeCacheResult,
  outputs: string[]
) {
  getCacheInstance().applyRemoteCacheResults(hash, result, outputs);
  return {
    response: 'true',
    description: 'handleCacheApplyRemoteResults',
  };
}

export async function handleCacheGetSize() {
  return {
    response: JSON.stringify(getCacheInstance().getCacheSize()),
    description: 'handleCacheGetSize',
  };
}

export async function handleCacheCheckFsInSync() {
  return {
    response: JSON.stringify(getCacheInstance().checkCacheFsInSync()),
    description: 'handleCacheCheckFsInSync',
  };
}
