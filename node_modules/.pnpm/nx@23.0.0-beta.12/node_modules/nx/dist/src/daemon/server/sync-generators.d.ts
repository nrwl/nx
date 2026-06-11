import type { ProjectGraph } from '../../config/project-graph';
import { type FlushSyncGeneratorChangesResult, type SyncGeneratorRunResult } from '../../utils/sync-generators';
export declare function clearSyncGeneratorsCache(): void;
export declare function getCachedSyncGeneratorChanges(generators: string[]): Promise<SyncGeneratorRunResult[]>;
export declare function flushSyncGeneratorChangesToDisk(generators: string[]): Promise<FlushSyncGeneratorChangesResult>;
export declare function collectAndScheduleSyncGenerators(projectGraph: ProjectGraph): void;
export declare function getCachedRegisteredSyncGenerators(): Promise<{
    globalGenerators: string[];
    taskGenerators: string[];
}>;
/**
 * @internal
 */
export declare function _getConflictingGeneratorGroups(results: SyncGeneratorRunResult[]): string[][];
