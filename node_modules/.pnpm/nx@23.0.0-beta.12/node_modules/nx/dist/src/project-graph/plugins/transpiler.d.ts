export declare let unregisterPluginTSTranspiler: (() => void) | null;
/**
 * Register swc-node or ts-node if they are not currently registered
 * with some default settings which work well for Nx plugins.
 */
export declare function registerPluginTSTranspiler(): void;
export declare function pluginTranspilerIsRegistered(): boolean;
export declare function cleanupPluginTSTranspiler(): void;
