export type DaemonMessage = {
  type: string;
  env?: Record<string, string>;
  data?: any;
};

export function isDaemonMessage(msg: unknown): msg is DaemonMessage {
  return typeof msg === 'object' && msg && 'type' in msg;
}
