import type { HandlerResult } from './server';
export declare function handleGetNxConsoleStatus(): Promise<HandlerResult>;
export declare function handleSetNxConsolePreferenceAndInstall(preference: boolean): Promise<HandlerResult>;
