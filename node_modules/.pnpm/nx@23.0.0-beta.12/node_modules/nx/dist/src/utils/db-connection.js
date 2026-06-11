"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDbConnection = getDbConnection;
exports.getLocalDbConnection = getLocalDbConnection;
const native_1 = require("../native");
const cache_directory_1 = require("./cache-directory");
const workspace_root_1 = require("./workspace-root");
const dbConnectionMap = new Map();
/**
 * Shared workspace-data directory, resolved once per process.
 * In a git worktree this points to the main repo's workspace-data dir
 * so all worktrees share the same DB.
 */
let _sharedDir;
function sharedWorkspaceDataDirectory(root) {
    if (_sharedDir)
        return _sharedDir;
    try {
        const mainRoot = (0, native_1.getMainWorktreeRoot)(root);
        if (mainRoot) {
            _sharedDir = (0, cache_directory_1.workspaceDataDirectoryForWorkspace)(mainRoot);
            return _sharedDir;
        }
    }
    catch {
        // Fall back to local workspace data if worktree detection fails
    }
    _sharedDir = (0, cache_directory_1.workspaceDataDirectoryForWorkspace)(root);
    return _sharedDir;
}
function getDbConnection(opts = {}) {
    opts.directory ??= sharedWorkspaceDataDirectory(workspace_root_1.workspaceRoot);
    const key = `${opts.directory}:${opts.dbName ?? 'default'}`;
    const connection = getEntryOrSet(dbConnectionMap, key, () => (0, native_1.connectToNxDb)(opts.directory, opts.dbName));
    return connection;
}
/**
 * Returns a DB connection scoped to the local worktree (not shared).
 * Use this for data that is inherently local to a worktree, such as
 * running task tracking, where sharing across worktrees would cause
 * false conflicts.
 */
function getLocalDbConnection(opts = {}) {
    const directory = (0, cache_directory_1.workspaceDataDirectoryForWorkspace)(workspace_root_1.workspaceRoot);
    const key = `${directory}:${opts.dbName ?? 'default'}`;
    const connection = getEntryOrSet(dbConnectionMap, key, () => (0, native_1.connectToNxDb)(directory, opts.dbName));
    return connection;
}
function removeDbConnections() {
    for (const connection of dbConnectionMap.values()) {
        (0, native_1.closeDbConnection)(connection);
    }
    dbConnectionMap.clear();
}
process.on('exit', removeDbConnections);
function getEntryOrSet(map, key, defaultValue) {
    const existing = map.get(key);
    if (existing) {
        return existing;
    }
    const val = defaultValue();
    map.set(key, val);
    return val;
}
