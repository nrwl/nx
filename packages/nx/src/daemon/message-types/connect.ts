export const CONNECT = 'CONNECT' as const;

export type ConnectMessage = {
  type: typeof CONNECT;
  data: {
    source: string;
    unref: boolean;
  };
};

export function isConnectMessage(message: unknown): message is ConnectMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === 'connect'
  );
}
