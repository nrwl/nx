import { TasksRunner } from './tasks-runner';
import { LifeCycle } from './life-cycle';
import { CachedResult } from '../native';
export interface RemoteCache {
    retrieve: (hash: string, cacheDirectory: string) => Promise<boolean>;
    store: (hash: string, cacheDirectory: string) => Promise<boolean>;
}
export declare abstract class RemoteCacheV2 {
    static fromCacheV1(cache: RemoteCache): Promise<RemoteCacheV2>;
    abstract retrieve(hash: string, cacheDirectory: string): Promise<CachedResult | null>;
    abstract store(hash: string, cacheDirectory: string, terminalOutput: string, code: number): Promise<boolean>;
}
export interface DefaultTasksRunnerOptions {
    parallel?: number;
    cacheableOperations?: string[];
    cacheableTargets?: string[];
    runtimeCacheInputs?: string[];
    cacheDirectory?: string;
    remoteCache?: RemoteCache;
    lifeCycle: LifeCycle;
    captureStderr?: boolean;
    skipNxCache?: boolean;
    skipRemoteCache?: boolean;
    batch?: boolean;
}
export declare const defaultTasksRunner: TasksRunner<DefaultTasksRunnerOptions>;
export default defaultTasksRunner;
