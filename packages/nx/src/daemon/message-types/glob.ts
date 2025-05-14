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

export const MULTI_GLOB = 'MULTI_GLOB' as const;
export type HandleMultiGlobMessage = {
  type: typeof MULTI_GLOB;
  globs: string[];
  exclude?: string[];
};

export function isHandleMultiGlobMessage(
  message: unknown
): message is HandleMultiGlobMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === MULTI_GLOB
  );
}
