import { CommandModule } from 'yargs';
export type ResetCommandOptions = {
    onlyCache?: boolean;
    onlyDaemon?: boolean;
    onlyWorkspaceData?: boolean;
    onlyCloud?: boolean;
};
export declare const yargsResetCommand: CommandModule<Record<string, unknown>, ResetCommandOptions>;
