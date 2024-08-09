export const FLUSH_SYNC_GENERATOR_CHANGES_TO_DISK =
  'CLEAR_CACHED_SYNC_GENERATOR_CHANGES' as const;

export type HandleFlushSyncGeneratorChangesToDiskMessage = {
  type: typeof FLUSH_SYNC_GENERATOR_CHANGES_TO_DISK;
  generators: string[];
};

export function isHandleFlushSyncGeneratorChangesToDiskMessage(
  message: unknown
): message is HandleFlushSyncGeneratorChangesToDiskMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === FLUSH_SYNC_GENERATOR_CHANGES_TO_DISK
  );
}
