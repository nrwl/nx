import { NxJsonConfiguration } from '../config/nx-json';
import { Task } from '../config/task-graph';
import { DefaultTasksRunnerOptions, RemoteCache } from './default-tasks-runner';
export type CachedResult = {
    terminalOutput: string;
    outputsPath: string;
    code: number;
    remote: boolean;
};
export type TaskWithCachedResult = {
    task: Task;
    cachedResult: CachedResult;
};
export declare function dbCacheEnabled(): boolean;
export declare function getCache(options: DefaultTasksRunnerOptions): DbCache | Cache;
export declare class DbCache {
    private readonly options;
    private nxJson;
    private cache;
    private remoteCache;
    private remoteCachePromise;
    private isVerbose;
    constructor(options: {
        nxCloudRemoteCache: RemoteCache;
        skipRemoteCache?: boolean;
    });
    init(): Promise<void>;
    get(task: Task): Promise<CachedResult | null>;
    getBatch(tasks: Task[]): Promise<Map<string, CachedResult & {
        remote: boolean;
    }>>;
    getUsedCacheSpace(): number;
    private applyRemoteCacheResults;
    put(task: Task, terminalOutput: string | null, outputs: string[], code: number): Promise<void>;
    copyFilesFromCache(_: string, cachedResult: CachedResult, outputs: string[]): Promise<number>;
    removeOldCacheRecords(): void;
    temporaryOutputPath(task: Task): string;
    private getRemoteCache;
    private _getRemoteCache;
    private getS3Cache;
    private getSharedCache;
    private getGcsCache;
    private getAzureCache;
    private getHttpCache;
    private resolveRemoteCache;
    private resolvePackage;
    private assertCacheIsValid;
}
/**
 * @deprecated Use the {@link DbCache} class instead. This will be removed in Nx 21.
 */
export declare class Cache {
    private readonly options;
    root: string;
    cachePath: string;
    terminalOutputsDir: string;
    constructor(options: DefaultTasksRunnerOptions);
    removeOldCacheRecords(): void;
    get(task: Task): Promise<CachedResult | null>;
    getBatch(tasks: Task[]): Promise<Map<string, CachedResult & {
        remote: boolean;
    }>>;
    put(task: Task, terminalOutput: string | null, outputs: string[], code: number): Promise<void>;
    copyFilesFromCache(hash: string, cachedResult: CachedResult, outputs: string[]): Promise<void>;
    temporaryOutputPath(task: Task): string;
    private expandOutputsInWorkspace;
    private expandOutputsInCache;
    private _expandOutputs;
    private copy;
    private remove;
    private getFromLocalDir;
    private assertLocalCacheValidity;
    private createCacheDir;
    private createTerminalOutputsDir;
}
/**
 * Resolves the max cache size from environment variable or nx.json configuration
 * and converts it to a number of bytes.
 *
 * @param nxJson The nx.json configuration object
 * @returns The resolved max cache size in bytes
 */
export declare function resolveMaxCacheSize(nxJson: NxJsonConfiguration): number;
/**
 * Converts a string representation of a max cache size to a number.
 *
 * e.g. '1GB' -> 1024 * 1024 * 1024
 *      '1MB' -> 1024 * 1024
 *      '1KB' -> 1024
 *
 * @param maxCacheSize Max cache size as specified in nx.json
 */
export declare function parseMaxCacheSize(maxCacheSize: string | number): number | undefined;
export declare function formatCacheSize(maxCacheSize: number, decimals?: number): string;
