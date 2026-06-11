import type { SyncArgs } from './command-object';
interface SyncOptions extends SyncArgs {
    check?: boolean;
}
export declare function syncHandler(options: SyncOptions): Promise<number>;
export {};
