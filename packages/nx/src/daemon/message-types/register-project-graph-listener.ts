export const REGISTER_PROJECT_GRAPH_LISTENER =
  'REGISTER_PROJECT_GRAPH_LISTENER';

export type RegisterProjectGraphListenerMessage = {
  type: typeof REGISTER_PROJECT_GRAPH_LISTENER;
};

export function isRegisterProjectGraphListenerMessage(
  message: unknown
): message is RegisterProjectGraphListenerMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === REGISTER_PROJECT_GRAPH_LISTENER
  );
}
