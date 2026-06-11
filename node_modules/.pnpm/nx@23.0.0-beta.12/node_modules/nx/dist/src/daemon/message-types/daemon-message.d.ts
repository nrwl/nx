export type DaemonMessage = {
    type: string;
    env?: Record<string, string>;
    data?: any;
};
export declare function isDaemonMessage(msg: unknown): msg is DaemonMessage;
