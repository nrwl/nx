export const GET_SYNC_GENERATOR_CHANGES = 'GET_SYNC_GENERATOR_CHANGES' as const;

export type HandleGetSyncGeneratorChangesMessage = {
  type: typeof GET_SYNC_GENERATOR_CHANGES;
  generators: string[];
};

export function isHandleGetSyncGeneratorChangesMessage(
  message: unknown
): message is HandleGetSyncGeneratorChangesMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === GET_SYNC_GENERATOR_CHANGES
  );
}
