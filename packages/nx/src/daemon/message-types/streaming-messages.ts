export const UPDATE_PROGRESS_MESSAGE = 'UPDATE_PROGRESS_MESSAGE' as const;

export type UpdateProgressMessage = {
  type: typeof UPDATE_PROGRESS_MESSAGE;
  message: string;
};

export function isUpdateProgressMessage(
  message: unknown
): message is UpdateProgressMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === UPDATE_PROGRESS_MESSAGE
  );
}

export const EMIT_LOG = 'EMIT_LOG' as const;

export type EmitLogLevel = 'log' | 'warn' | 'error';

export type EmitLogMessage = {
  type: typeof EMIT_LOG;
  level: EmitLogLevel;
  message: string;
};

export function isEmitLogMessage(message: unknown): message is EmitLogMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === EMIT_LOG
  );
}
