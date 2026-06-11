export interface IncompatibleFiles {
    [pluginIndex: number]: {
        file: string;
        error?: any;
    }[];
}
/**
 * This function checks if the imported project is compatible with the plugins.
 * @returns a map of plugin names to files that are incompatible with the plugins
 */
export declare function checkCompatibleWithPlugins(): Promise<IncompatibleFiles>;
/**
 * This function updates the plugins in the nx.json file with the given plugin names and files to exclude.
 */
export declare function updatePluginsInNxJson(root: string, pluginToExcludeFiles: IncompatibleFiles): void;
