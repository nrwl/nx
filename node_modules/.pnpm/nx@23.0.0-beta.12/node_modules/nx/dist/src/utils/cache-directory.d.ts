/**
 * Path to the directory where Nx stores its cache and daemon-related files.
 * In a git worktree this resolves to the main repo's cache dir so all
 * worktrees share the same cache.
 */
export declare const cacheDir: string;
export declare function cacheDirectoryForWorkspace(root: string): string;
export declare const workspaceDataDirectory: string;
export declare function workspaceDataDirectoryForWorkspace(workspaceRoot: string): string;
