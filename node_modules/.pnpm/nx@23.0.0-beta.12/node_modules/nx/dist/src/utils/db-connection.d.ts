import { ExternalObject } from '../native';
export declare function getDbConnection(opts?: {
    directory?: string;
    dbName?: string;
}): ExternalObject<any>;
/**
 * Returns a DB connection scoped to the local worktree (not shared).
 * Use this for data that is inherently local to a worktree, such as
 * running task tracking, where sharing across worktrees would cause
 * false conflicts.
 */
export declare function getLocalDbConnection(opts?: {
    dbName?: string;
}): ExternalObject<any>;
