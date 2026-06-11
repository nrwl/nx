export declare const SHOULD_SHOW_SPINNERS: boolean;
declare class SpinnerManager {
    #private;
    start(text?: string, prefix?: string): SpinnerManager;
    succeed(text?: string): void;
    stop(): void;
    fail(text?: string): void;
    updateText(text?: string): void;
    isSpinning(): boolean;
}
export declare const globalSpinner: SpinnerManager;
export {};
