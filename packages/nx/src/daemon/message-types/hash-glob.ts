export const HASH_GLOB = 'HASH_GLOB' as const;

export type HandleHashGlobMessage = {
  type: typeof HASH_GLOB;
  globs: string[];
  exclude?: string[];
};

export function isHandleHashGlobMessage(
  message: unknown
): message is HandleHashGlobMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === HASH_GLOB
  );
}
