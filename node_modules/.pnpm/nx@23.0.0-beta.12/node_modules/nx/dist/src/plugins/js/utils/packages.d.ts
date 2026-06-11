import type { ProjectGraphProjectNode } from '../../../config/project-graph';
import type { ProjectConfiguration } from '../../../config/workspace-json-project-json';
export declare function getWorkspacePackagesMetadata<T extends ProjectGraphProjectNode | ProjectConfiguration>(projects: Record<string, T>): {
    entryPointsToProjectMap: Record<string, T>;
    wildcardEntryPointsToProjectMap: Record<string, T>;
    packageToProjectMap: Record<string, T>;
};
export declare function matchImportToWildcardEntryPointsToProjectMap<T extends ProjectGraphProjectNode | ProjectConfiguration>(wildcardEntryPointsToProjectMap: Record<string, T>, importPath: string): T | null;
