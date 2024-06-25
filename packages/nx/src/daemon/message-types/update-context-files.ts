export const GLOB = 'GLOB' as const;

export type HandleUpdateContextMessage = {
  type: typeof GLOB;
  updatedFiles: string[];
  deletedFiles: string[];
};

export function isHandleUpdateContextMessage(
  message: unknown
): message is HandleUpdateContextMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === GLOB
  );
}
