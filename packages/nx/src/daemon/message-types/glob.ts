export const GLOB = 'GLOB' as const;

export type HandleGlobMessage = {
  type: typeof GLOB;
  globs: string[];
  exclude?: string[];
};

export function isHandleGlobMessage(
  message: unknown
): message is HandleGlobMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === GLOB
  );
}
