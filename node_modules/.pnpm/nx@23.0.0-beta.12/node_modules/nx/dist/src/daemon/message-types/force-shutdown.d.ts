export declare const FORCE_SHUTDOWN: "FORCE_SHUTDOWN";
export type HandleForceShutdownMessage = {
    type: typeof FORCE_SHUTDOWN;
};
export declare function isHandleForceShutdownMessage(message: unknown): message is HandleForceShutdownMessage;
