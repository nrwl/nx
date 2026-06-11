/**
 * Translates NodeJS signals to numeric exit code
 * @param signal
 */
export declare function signalToCode(signal: NodeJS.Signals | null): number;
/**
 * Translates numeric exit codes to NodeJS signals
 */
export declare function codeToSignal(code: number): NodeJS.Signals;
export declare const EXPECTED_TERMINATION_SIGNALS: Set<number>;
/**
 * Translates a pty exit message (e.g. "Terminated by Interrupt") to a numeric exit code.
 * Handles both Linux exact-match and macOS strsignal formats (e.g. "Terminated by Hangup: 1").
 */
export declare function messageToCode(message: string): number;
