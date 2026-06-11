export declare const NX_PREFIX: string;
export declare const NX_ERROR: string;
type LogDriver = Pick<Console, 'warn' | 'error' | 'info' | 'log' | 'debug'>;
export declare function createLogger(driver: LogDriver): {
    warn: (...v: any[]) => void;
    error: (s: any) => void;
    info: (s: any) => void;
    log: (...s: any[]) => void;
    debug: (...s: any[]) => void;
    fatal: (...s: any[]) => void;
    verbose: (...s: any[]) => void;
};
export declare const logger: {
    warn: (...v: any[]) => void;
    error: (s: any) => void;
    info: (s: any) => void;
    log: (...s: any[]) => void;
    debug: (...s: any[]) => void;
    fatal: (...s: any[]) => void;
    verbose: (...s: any[]) => void;
};
export declare function stripIndent(str: string): string;
export {};
