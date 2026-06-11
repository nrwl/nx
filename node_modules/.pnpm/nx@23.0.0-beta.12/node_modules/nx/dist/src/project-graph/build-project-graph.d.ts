import { FileMap, ProjectGraph, ProjectGraphExternalNode } from '../config/project-graph';
import { ProjectConfiguration } from '../config/workspace-json-project-json';
import { NxWorkspaceFilesExternals } from '../native';
import { CreateMetadataError } from './error-types';
import { FileData } from './file-utils';
import { FileMapCache } from './nx-deps-cache';
import { CreateMetadataContext } from './plugins';
import type { LoadedNxPlugin } from './plugins/loaded-nx-plugin';
import type { ConfigurationSourceMaps } from './utils/project-configuration/source-maps';
export declare function getFileMap(): {
    fileMap: FileMap;
    rustReferences: NxWorkspaceFilesExternals | null;
    /** @deprecated always `[]`; kept so cached nx-cloud workers that destructure it don't see `undefined`. */
    allWorkspaceFiles: FileData[];
};
export declare function hydrateFileMap(fileMap: FileMap, rustReferences: NxWorkspaceFilesExternals): void;
/** @deprecated pass `(fileMap, rustReferences)`. Kept for cached nx-cloud workers still on the 3-arg form. */
export declare function hydrateFileMap(fileMap: FileMap, allWorkspaceFiles: FileData[], rustReferences: NxWorkspaceFilesExternals): void;
export declare function buildProjectGraphUsingProjectFileMap(projectRootMap: Record<string, ProjectConfiguration>, externalNodes: Record<string, ProjectGraphExternalNode>, fileMap: FileMap, rustReferences: NxWorkspaceFilesExternals, fileMapCache: FileMapCache | null, plugins: LoadedNxPlugin[], sourceMap: ConfigurationSourceMaps): Promise<{
    projectGraph: ProjectGraph;
    projectFileMapCache: FileMapCache;
}>;
export declare function applyProjectMetadata(graph: ProjectGraph, plugins: LoadedNxPlugin[], context: CreateMetadataContext, sourceMap: ConfigurationSourceMaps): Promise<{
    graph: ProjectGraph;
    errors?: CreateMetadataError[];
}>;
