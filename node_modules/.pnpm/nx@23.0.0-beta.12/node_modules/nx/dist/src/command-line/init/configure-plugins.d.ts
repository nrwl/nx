import { PackageManagerCommands } from '../../utils/package-manager';
export declare function installPluginPackages(repoRoot: string, pmc: PackageManagerCommands, plugins: string[]): void;
/**
 * Installs a plugin by running its init generator. It will change the file system tree passed in.
 * @param plugin The name of the plugin to install
 * @param repoRoot repo root
 * @param pmc package manager commands
 * @param updatePackageScripts whether to update package scripts
 * @param verbose whether to run in verbose mode
 * @returns void
 */
export declare function runPluginInitGenerator(plugin: string, repoRoot?: string, updatePackageScripts?: boolean, verbose?: boolean, pmc?: PackageManagerCommands): Promise<void>;
/**
 * Install plugins
 * Get the implementation of the plugin's init generator and run it
 * @returns a list of succeeded plugins and a map of failed plugins to errors
 */
export declare function runPluginInitGenerators(plugins: string[], updatePackageScripts: boolean, pmc: PackageManagerCommands, repoRoot?: string, verbose?: boolean): Promise<{
    succeededPlugins: string[];
    failedPlugins: {
        [plugin: string]: Error;
    };
}>;
/**
 * Configures plugins, installs them, and outputs the results
 * @returns a list of succeeded plugins and a map of failed plugins to errors
 */
export declare function configurePlugins(plugins: string[], updatePackageScripts: boolean, pmc: PackageManagerCommands, repoRoot?: string, verbose?: boolean): Promise<{
    succeededPlugins: string[];
    failedPlugins: {
        [plugin: string]: Error;
    };
}>;
export declare function getFailedToInstallPluginErrorMessages(e: any): string[];
