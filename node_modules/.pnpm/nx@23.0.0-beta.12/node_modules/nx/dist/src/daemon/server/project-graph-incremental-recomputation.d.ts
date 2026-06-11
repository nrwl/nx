import { Socket } from 'net';
import { FileMap, ProjectGraph } from '../../config/project-graph';
import { NxWorkspaceFilesExternals } from '../../native';
import { FileMapCache } from '../../project-graph/nx-deps-cache';
import { ConfigurationSourceMaps } from '../../project-graph/utils/project-configuration/source-maps';
interface SerializedProjectGraph {
    error: Error | null;
    projectGraph: ProjectGraph | null;
    projectFileMapCache: FileMapCache | null;
    serializedProjectGraph: string | null;
    serializedSourceMaps: string | null;
    sourceMaps: ConfigurationSourceMaps | null;
    rustReferences: NxWorkspaceFilesExternals | null;
}
export declare let fileMapWithFiles: {
    fileMap: FileMap;
    rustReferences: NxWorkspaceFilesExternals;
} | undefined;
export declare let currentProjectFileMapCache: FileMapCache | undefined;
export declare let currentProjectGraph: ProjectGraph | undefined;
export declare let currentSourceMaps: ConfigurationSourceMaps | undefined;
export declare function getCachedSerializedProjectGraphPromise(socket?: Socket): Promise<SerializedProjectGraph>;
export declare function scheduleProjectGraphRecomputation(createdFiles: string[], updatedFiles: string[], deletedFiles: string[]): void;
export declare function registerProjectGraphRecomputationListener(listener: (projectGraph: ProjectGraph, sourceMaps: ConfigurationSourceMaps, error: Error | null) => void): void;
export declare function invalidateGraphCache(): void;
export {};
