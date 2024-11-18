import { Message } from '../client/daemon-socket-messenger';

export const FORCE_SHUTDOWN = 'FORCE_SHUTDOWN' as const;

export type HandleForceShutdownMessage = Message & {
  type: typeof FORCE_SHUTDOWN;
};

export function isHandleForceShutdownMessage(
  message: unknown
): message is HandleForceShutdownMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === FORCE_SHUTDOWN
  );
}
