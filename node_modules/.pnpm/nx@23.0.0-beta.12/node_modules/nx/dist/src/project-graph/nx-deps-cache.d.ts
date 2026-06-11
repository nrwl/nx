import { NxJsonConfiguration } from '../config/nx-json';
import type { FileData, FileMap, ProjectGraph } from '../config/project-graph';
import { ProjectConfiguration } from '../config/workspace-json-project-json';
import { ProjectGraphErrorTypes } from './error-types';
import { ConfigurationSourceMaps } from './utils/project-configuration/source-maps';
export interface FileMapCache {
    version: string;
    nxVersion: string;
    pathMappings: Record<string, any>;
    nxJsonPlugins: PluginData[];
    pluginsConfig?: any;
    fileMap: FileMap;
    externalNodesHash?: string;
}
export declare const nxProjectGraph: string;
export declare const nxFileMap: string;
export declare const nxSourceMaps: string;
export declare function ensureCacheDirectory(): void;
export declare function readFileMapCache(): null | FileMapCache;
export declare function readProjectGraphCache(minimumComputedAt?: number): null | ProjectGraph;
export declare function readSourceMapsCache(): null | ConfigurationSourceMaps;
export declare function createProjectFileMapCache(nxJson: NxJsonConfiguration<'*' | string[]>, packageJsonDeps: Record<string, string>, fileMap: FileMap, tsConfig: {
    compilerOptions?: {
        paths?: {
            [p: string]: any;
        };
    };
}, externalNodesHash: string): FileMapCache;
export declare function writeCache(cache: FileMapCache, projectGraph: ProjectGraph, sourceMaps: ConfigurationSourceMaps, errors: ProjectGraphErrorTypes[]): void;
/**
 * Writes the cache only if the on-disk cache file has been modified since
 * this process last wrote it (i.e. an external process overwrote it), or
 * if this process has never written the cache.
 *
 * Use this instead of writeCache() on hot paths where the same graph may
 * be served multiple times without changing (e.g. the daemon responding
 * to repeated client requests).
 */
export declare function writeCacheIfStale(cache: FileMapCache, projectGraph: ProjectGraph, sourceMaps: ConfigurationSourceMaps, errors: ProjectGraphErrorTypes[]): void;
export declare function shouldRecomputeWholeGraph(cache: FileMapCache, packageJsonDeps: Record<string, string>, projects: Record<string, ProjectConfiguration>, nxJson: NxJsonConfiguration, tsConfig: {
    compilerOptions: {
        paths: {
            [k: string]: any;
        };
    };
}, externalNodesHash: string): boolean;
export type CachedFileData = {
    nonProjectFiles: Record<string, FileData>;
    projectFileMap: {
        [project: string]: Record<string, FileData>;
    };
};
export declare function extractCachedFileData(fileMap: FileMap, c: FileMapCache): {
    filesToProcess: FileMap;
    cachedFileData: CachedFileData;
};
type PluginData = {
    name: string;
    version: string;
    options?: unknown;
};
export {};
