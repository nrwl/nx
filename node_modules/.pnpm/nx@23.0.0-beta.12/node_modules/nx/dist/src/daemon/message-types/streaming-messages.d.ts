export declare const UPDATE_PROGRESS_MESSAGE: "UPDATE_PROGRESS_MESSAGE";
export type UpdateProgressMessage = {
    type: typeof UPDATE_PROGRESS_MESSAGE;
    message: string;
};
export declare function isUpdateProgressMessage(message: unknown): message is UpdateProgressMessage;
export declare const EMIT_LOG: "EMIT_LOG";
export type EmitLogLevel = 'log' | 'warn' | 'error';
export type EmitLogMessage = {
    type: typeof EMIT_LOG;
    level: EmitLogLevel;
    message: string;
};
export declare function isEmitLogMessage(message: unknown): message is EmitLogMessage;
