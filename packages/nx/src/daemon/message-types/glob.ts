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

export const SHEBANG_FILES = 'SHEBANG_FILES' as const;
export type HandleShebangFilesMessage = {
  type: typeof SHEBANG_FILES;
  globs: string[];
  exclude?: string[];
};

export function isHandleShebangFilesMessage(
  message: unknown
): message is HandleShebangFilesMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === SHEBANG_FILES
  );
}
