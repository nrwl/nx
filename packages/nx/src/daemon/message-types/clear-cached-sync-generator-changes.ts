export const CLEAR_CACHED_SYNC_GENERATOR_CHANGES =
  'CLEAR_CACHED_SYNC_GENERATOR_CHANGES' as const;

export type HandleCachedClearSyncGeneratorChangesMessage = {
  type: typeof CLEAR_CACHED_SYNC_GENERATOR_CHANGES;
  generators: string[];
};

export function isHandleCachedClearSyncGeneratorChangesMessage(
  message: unknown
): message is HandleCachedClearSyncGeneratorChangesMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === CLEAR_CACHED_SYNC_GENERATOR_CHANGES
  );
}
