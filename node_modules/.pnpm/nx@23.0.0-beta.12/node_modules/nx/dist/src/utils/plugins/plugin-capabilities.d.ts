import { ExecutorsJsonEntry, GeneratorsJsonEntry } from '../../config/misc-interfaces';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';
export interface PluginCapabilities {
    name: string;
    path?: string;
    executors?: {
        [name: string]: ExecutorsJsonEntry;
    };
    generators?: {
        [name: string]: GeneratorsJsonEntry;
    };
    projectInference?: boolean;
    projectGraphExtension?: boolean;
}
export declare function getPluginCapabilities(workspaceRoot: string, pluginName: string, projects: Record<string, ProjectConfiguration>, includeRuntimeCapabilities?: boolean): Promise<PluginCapabilities | null>;
