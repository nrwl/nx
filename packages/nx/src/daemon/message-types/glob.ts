import { Message } from '../client/daemon-socket-messenger';

export const GLOB = 'GLOB' as const;

export type HandleGlobMessage = Message & {
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
