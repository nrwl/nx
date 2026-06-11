import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { PluginCapabilities } from './plugin-capabilities';
export declare function listPlugins(plugins: Map<string, PluginCapabilities>, title: string): void;
export declare function listAlsoAvailableCorePlugins(installedPlugins: Map<string, PluginCapabilities>): void;
export declare function listPowerpackPlugins(): void;
export declare function listPluginCapabilities(pluginName: string, projects: Record<string, ProjectConfiguration>, json?: boolean): Promise<void>;
export declare function formatPluginCapabilitiesAsJson(plugin: PluginCapabilities): {
    name: string;
    path: string;
    generators: Record<string, {
        description: string;
        path: string | null;
        schema: string | null;
    }>;
    executors: Record<string, {
        description: string;
        path: string | null;
        schema: string | null;
    }>;
    projectGraphExtension: boolean;
    projectInference: boolean;
};
export declare function formatPluginsAsJson(localPlugins: Map<string, PluginCapabilities>, installedPlugins: Map<string, PluginCapabilities>): {
    localWorkspacePlugins: {
        name: string;
        path: string;
        capabilities: string[];
    }[];
    installedPlugins: {
        name: string;
        path: string;
        capabilities: string[];
    }[];
};
