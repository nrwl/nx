import type { CommandModule } from 'yargs';
export interface SyncArgs {
    verbose?: boolean;
}
export declare const yargsSyncCommand: CommandModule<Record<string, unknown>, SyncArgs>;
export declare const yargsSyncCheckCommand: CommandModule<Record<string, unknown>, SyncArgs>;
