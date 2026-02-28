import type { CachedResult as NativeCacheResult } from '../../native';

export const CACHE_GET = 'CACHE_GET' as const;
export const CACHE_PUT = 'CACHE_PUT' as const;
export const CACHE_REMOVE_OLD_RECORDS = 'CACHE_REMOVE_OLD_RECORDS' as const;
export const CACHE_APPLY_REMOTE_RESULTS = 'CACHE_APPLY_REMOTE_RESULTS' as const;
export const CACHE_GET_SIZE = 'CACHE_GET_SIZE' as const;
export const CACHE_CHECK_FS_IN_SYNC = 'CACHE_CHECK_FS_IN_SYNC' as const;

export type HandleCacheGetMessage = {
  type: typeof CACHE_GET;
  hash: string;
};

export type HandleCachePutMessage = {
  type: typeof CACHE_PUT;
  hash: string;
  terminalOutput: string | null;
  outputs: string[];
  code: number;
};

export type HandleCacheRemoveOldRecordsMessage = {
  type: typeof CACHE_REMOVE_OLD_RECORDS;
};

export type HandleCacheApplyRemoteResultsMessage = {
  type: typeof CACHE_APPLY_REMOTE_RESULTS;
  hash: string;
  result: NativeCacheResult;
  outputs: string[];
};

export type HandleCacheGetSizeMessage = {
  type: typeof CACHE_GET_SIZE;
};

export type HandleCacheCheckFsInSyncMessage = {
  type: typeof CACHE_CHECK_FS_IN_SYNC;
};

export function isHandleCacheGetMessage(
  message: unknown
): message is HandleCacheGetMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === CACHE_GET
  );
}

export function isHandleCachePutMessage(
  message: unknown
): message is HandleCachePutMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === CACHE_PUT
  );
}

export function isHandleCacheRemoveOldRecordsMessage(
  message: unknown
): message is HandleCacheRemoveOldRecordsMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === CACHE_REMOVE_OLD_RECORDS
  );
}

export function isHandleCacheApplyRemoteResultsMessage(
  message: unknown
): message is HandleCacheApplyRemoteResultsMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === CACHE_APPLY_REMOTE_RESULTS
  );
}

export function isHandleCacheGetSizeMessage(
  message: unknown
): message is HandleCacheGetSizeMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === CACHE_GET_SIZE
  );
}

export function isHandleCacheCheckFsInSyncMessage(
  message: unknown
): message is HandleCacheCheckFsInSyncMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === CACHE_CHECK_FS_IN_SYNC
  );
}
