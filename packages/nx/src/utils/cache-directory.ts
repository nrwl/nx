import { existsSync, statSync } from 'fs';
import { isAbsolute, join } from 'path';
import { execSync } from 'child_process';
import { NxJsonConfiguration } from '../config/nx-json';
import { readJsonFile } from './fileutils';
import { workspaceRoot } from './workspace-root';

function readCacheDirectoryProperty(root: string): string | undefined {
  try {
    const nxJson = readJsonFile<NxJsonConfiguration>(join(root, 'nx.json'));
    return (
      nxJson.cacheDirectory ??
      nxJson.tasksRunnerOptions?.default.options.cacheDirectory
    );
  } catch {
    return undefined;
  }
}

function absolutePath(root: string, path: string): string {
  if (isAbsolute(path)) {
    return path;
  } else {
    return join(root, path);
  }
}

// ============================================================
// Worktree detection and cache sharing
// ============================================================

/**
 * Check if .git is a file (worktree) or directory (main repo).
 * Git worktrees have a .git file containing `gitdir: /path/to/main/.git/worktrees/{name}`
 */
export function isGitWorktree(root: string): boolean {
  const gitPath = join(root, '.git');

  if (!existsSync(gitPath)) {
    return false;
  }

  try {
    return statSync(gitPath).isFile();
  } catch {
    return false;
  }
}

/**
 * Get git version to check for worktree support (requires 2.5+)
 */
function getGitVersion(): { major: number; minor: number } | null {
  try {
    const output = execSync('git --version', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const match = output.match(/git version (\d+)\.(\d+)/);
    if (!match) {
      return null;
    }

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
    };
  } catch {
    return null;
  }
}

/**
 * Check if git version supports worktrees (2.5+)
 */
function gitSupportsWorktrees(): boolean {
  const version = getGitVersion();
  if (!version) {
    return false;
  }
  return version.major > 2 || (version.major === 2 && version.minor >= 5);
}

/**
 * Get the main repository root from a worktree using git rev-parse --git-common-dir.
 * Returns the path without the trailing /.git
 */
export function getMainRepoRoot(worktreeRoot: string): string | null {
  try {
    const gitCommonDir = execSync('git rev-parse --git-common-dir', {
      cwd: worktreeRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    // Make absolute if relative
    const absoluteGitDir = gitCommonDir.startsWith('/')
      ? gitCommonDir
      : join(worktreeRoot, gitCommonDir);

    // Strip /.git suffix to get main repo root
    return absoluteGitDir.replace(/[/\\]\.git\/?$/, '');
  } catch {
    return null;
  }
}

/**
 * Check skip conditions for worktree cache sharing.
 * Returns the reason if should skip, null otherwise.
 */
function shouldSkipWorktreeCacheSharing(): {
  skip: boolean;
  reason?: string;
  silent?: boolean;
} {
  // Skip silently in CI (Cloud Agents can't access local worktree cache)
  if (process.env.CI) {
    return { skip: true, reason: 'CI environment', silent: true };
  }

  // Skip silently if custom cache directory is already set
  if (process.env.NX_CACHE_DIRECTORY) {
    return { skip: true, reason: 'NX_CACHE_DIRECTORY is set', silent: true };
  }

  // Skip with warning if git is too old
  if (!gitSupportsWorktrees()) {
    return {
      skip: true,
      reason: 'Git version does not support worktrees (requires 2.5+)',
      silent: false,
    };
  }

  return { skip: false };
}

/**
 * Resolve the main repo root for worktree sharing.
 * Returns the main repo root if in a worktree, null otherwise.
 */
function resolveWorktreeMainRoot(root: string): string | null {
  const skipCheck = shouldSkipWorktreeCacheSharing();
  if (skipCheck.skip) {
    if (!skipCheck.silent && process.env.NX_VERBOSE_LOGGING) {
      console.warn(
        `Worktree cache sharing disabled: ${skipCheck.reason}. Worktrees will use independent caches.`
      );
    }
    return null;
  }

  if (!isGitWorktree(root)) {
    return null; // Not a worktree, use normal cache
  }

  const mainRepoRoot = getMainRepoRoot(root);
  if (!mainRepoRoot) {
    return null; // Failed to resolve, fall back to local cache
  }

  // Verify main repo still exists
  if (!existsSync(mainRepoRoot)) {
    throw new Error(
      `Cannot access shared cache: The main repository may have been moved or deleted.\n` +
        `Worktree path: ${root}\n` +
        `Expected main repo: ${mainRepoRoot}`
    );
  }

  return mainRepoRoot;
}

// ============================================================
// Cache directory resolution
// ============================================================

function cacheDirectory(root: string, cacheDirectory: string) {
  const cacheDirFromEnv = process.env.NX_CACHE_DIRECTORY;
  if (cacheDirFromEnv) {
    cacheDirectory = cacheDirFromEnv;
  }
  if (cacheDirectory) {
    return absolutePath(root, cacheDirectory);
  }

  // Check for worktree and resolve shared cache
  const mainRepoRoot = resolveWorktreeMainRoot(root);
  if (mainRepoRoot) {
    return join(mainRepoRoot, '.nx', 'cache');
  }

  return defaultCacheDirectory(root);
}

function pickCacheDirectory(
  root: string,
  nonNxCacheDirectory: string,
  nxCacheDirectory: string
) {
  // If nx.json doesn't exist the repo can't utilize
  // caching, so .nx/cache is less relevant. Lerna users
  // that don't want to fully opt in to Nx at this time
  // may also be caught off guard by the appearance of
  // a .nx directory, so we are going to special case
  // this for the time being.
  if (
    existsSync(join(root, 'lerna.json')) &&
    !existsSync(join(root, 'nx.json'))
  ) {
    return join(root, 'node_modules', '.cache', nonNxCacheDirectory);
  }
  return join(root, '.nx', nxCacheDirectory);
}

function defaultCacheDirectory(root: string) {
  return pickCacheDirectory(root, 'nx', 'cache');
}

function defaultWorkspaceDataDirectory(root: string) {
  return pickCacheDirectory(root, 'nx-workspace-data', 'workspace-data');
}

/**
 * Path to the directory where Nx stores its cache and daemon-related files.
 */
export const cacheDir = cacheDirectory(
  workspaceRoot,
  readCacheDirectoryProperty(workspaceRoot)
);

export function cacheDirectoryForWorkspace(workspaceRoot: string) {
  return cacheDirectory(
    workspaceRoot,
    readCacheDirectoryProperty(workspaceRoot)
  );
}

export const workspaceDataDirectory =
  workspaceDataDirectoryForWorkspace(workspaceRoot);

export function workspaceDataDirectoryForWorkspace(workspaceRoot: string) {
  // Note: We intentionally do NOT share workspace-data between worktrees.
  // The daemon runs per-workspace and tracks output hashes in memory.
  // Sharing the daemon directory would cause incorrect cache hit detection.
  // Only the cache directory (cacheDir) is shared between worktrees.
  return absolutePath(
    workspaceRoot,
    process.env.NX_WORKSPACE_DATA_DIRECTORY ??
      process.env.NX_PROJECT_GRAPH_CACHE_DIRECTORY ??
      defaultWorkspaceDataDirectory(workspaceRoot)
  );
}
