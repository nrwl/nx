"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceDataDirectory = exports.cacheDir = void 0;
exports.cacheDirectoryForWorkspace = cacheDirectoryForWorkspace;
exports.workspaceDataDirectoryForWorkspace = workspaceDataDirectoryForWorkspace;
const fs_1 = require("fs");
const path_1 = require("path");
const native_1 = require("../native");
const fileutils_1 = require("./fileutils");
const workspace_root_1 = require("./workspace-root");
function readCacheDirectoryProperty(root) {
    try {
        const nxJson = (0, fileutils_1.readJsonFile)((0, path_1.join)(root, 'nx.json'));
        return (nxJson.cacheDirectory ??
            nxJson.tasksRunnerOptions?.default.options.cacheDirectory);
    }
    catch {
        return undefined;
    }
}
function absolutePath(root, path) {
    if ((0, path_1.isAbsolute)(path)) {
        return path;
    }
    else {
        return (0, path_1.join)(root, path);
    }
}
function cacheDirectory(root, cacheDirectory) {
    const cacheDirFromEnv = process.env.NX_CACHE_DIRECTORY;
    if (cacheDirFromEnv) {
        cacheDirectory = cacheDirFromEnv;
    }
    if (cacheDirectory) {
        return absolutePath(root, cacheDirectory);
    }
    else {
        return defaultCacheDirectory(root);
    }
}
function pickCacheDirectory(root, nonNxCacheDirectory, nxCacheDirectory) {
    // If nx.json doesn't exist the repo can't utilize
    // caching, so .nx/cache is less relevant. Lerna users
    // that don't want to fully opt in to Nx at this time
    // may also be caught off guard by the appearance of
    // a .nx directory, so we are going to special case
    // this for the time being.
    if ((0, fs_1.existsSync)((0, path_1.join)(root, 'lerna.json')) &&
        !(0, fs_1.existsSync)((0, path_1.join)(root, 'nx.json'))) {
        return (0, path_1.join)(root, 'node_modules', '.cache', nonNxCacheDirectory);
    }
    return (0, path_1.join)(root, '.nx', nxCacheDirectory);
}
function defaultCacheDirectory(root) {
    return pickCacheDirectory(root, 'nx', 'cache');
}
function defaultWorkspaceDataDirectory(root) {
    return pickCacheDirectory(root, 'nx-workspace-data', 'workspace-data');
}
/**
 * Path to the directory where Nx stores its cache and daemon-related files.
 * In a git worktree this resolves to the main repo's cache dir so all
 * worktrees share the same cache.
 */
exports.cacheDir = sharedCacheDirectory(workspace_root_1.workspaceRoot);
function cacheDirectoryForWorkspace(root) {
    return cacheDirectory(root, readCacheDirectoryProperty(root));
}
function sharedCacheDirectory(root) {
    try {
        const mainRoot = (0, native_1.getMainWorktreeRoot)(root);
        if (mainRoot) {
            return cacheDirectoryForWorkspace(mainRoot);
        }
    }
    catch {
        // Fall back to local cache if worktree detection fails
    }
    return cacheDirectoryForWorkspace(root);
}
exports.workspaceDataDirectory = workspaceDataDirectoryForWorkspace(workspace_root_1.workspaceRoot);
function workspaceDataDirectoryForWorkspace(workspaceRoot) {
    return absolutePath(workspaceRoot, process.env.NX_WORKSPACE_DATA_DIRECTORY ??
        process.env.NX_PROJECT_GRAPH_CACHE_DIRECTORY ??
        defaultWorkspaceDataDirectory(workspaceRoot));
}
