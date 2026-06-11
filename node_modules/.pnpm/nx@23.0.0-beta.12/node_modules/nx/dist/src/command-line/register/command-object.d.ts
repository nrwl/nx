import { CommandModule } from 'yargs';
export interface RegisterOptions {
    key?: string;
    verbose?: boolean;
}
export declare const yargsRegisterCommand: CommandModule<{}, RegisterOptions>;
