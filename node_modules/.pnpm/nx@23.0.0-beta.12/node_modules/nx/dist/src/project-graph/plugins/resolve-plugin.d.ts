import type { ProjectConfiguration } from '../../config/workspace-json-project-json';
export declare function resolveNxPlugin(moduleName: string, root: string, paths: string[]): Promise<{
    pluginPath: string;
    name: any;
    shouldRegisterTSTranspiler: boolean;
}>;
export declare function resolveLocalNxPlugin(importPath: string, projects: Record<string, ProjectConfiguration>, root?: string): {
    path: string;
    projectConfig: ProjectConfiguration;
} | null;
export declare function getPluginPathAndName(moduleName: string, paths: string[], projects: Record<string, ProjectConfiguration>, root: string): {
    pluginPath: string;
    name: any;
    shouldRegisterTSTranspiler: boolean;
};
