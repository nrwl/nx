import { CommandModule } from 'yargs';
export interface AddOptions {
    packageSpecifier: string;
    updatePackageScripts?: boolean;
    verbose?: boolean;
    __overrides_unparsed__: string[];
}
export declare const yargsAddCommand: CommandModule<{}, AddOptions>;
