import { type ProjectGraphExternalNode } from '../../../config/project-graph';
import type { CreateDependenciesContext } from '../../../project-graph/plugins';
import { type RawProjectGraphDependency } from '../../../project-graph/project-graph-builder';
export declare const BUN_LOCK_FILE = "bun.lockb";
export declare const BUN_TEXT_LOCK_FILE = "bun.lock";
export declare class BunLockfileParseError extends Error {
    readonly cause?: Error;
    constructor(message: string, cause?: Error);
}
export declare function readBunLockFile(lockFilePath: string): string;
export declare function getBunTextLockfileDependencies(lockFileContent: string, lockFileHash: string, ctx: CreateDependenciesContext): RawProjectGraphDependency[];
/** @internal */
export declare function clearCache(): void;
export declare function getBunTextLockfileNodes(lockFileContent: string, lockFileHash: string): Record<string, ProjectGraphExternalNode>;
