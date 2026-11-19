import { execSync } from 'child_process';
import { existsSync, readdirSync, renameSync, rmSync } from 'fs';
import { join } from 'path';
import {
  NX_HOME_TMP_DIR,
  NX_TMP_DIR,
  NX_USER_TMP_DIR,
} from '../utils/nx-tmp-dir';
import {
  canonicalDir,
  type DirRefusal,
  DirectoryRefusedError,
  ensureOwnedPrivateDir,
  ensureSafeSharedRoot,
} from '../utils/owned-private-dir';

const REPO_URL = 'https://github.com/nrwl/nx-ai-agents-config';
const CACHE_DIR_NAME = 'nx-ai-agents-config';

// `git rev-parse --local-env-vars`, plus GIT_NAMESPACE and the indexed
// GIT_CONFIG_KEY_<n> / GIT_CONFIG_VALUE_<n> pairs. Hooks export GIT_INDEX_FILE;
// inheriting it makes `git clone` rewrite the caller's index.
const GIT_LOCAL_REPO_ENV_VARS = new Set([
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_CONFIG',
  'GIT_CONFIG_COUNT',
  'GIT_CONFIG_PARAMETERS',
  'GIT_DIR',
  'GIT_GRAFT_FILE',
  'GIT_IMPLICIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_NAMESPACE',
  'GIT_NO_REPLACE_OBJECTS',
  'GIT_OBJECT_DIRECTORY',
  'GIT_PREFIX',
  'GIT_REPLACE_REF_BASE',
  'GIT_SHALLOW_FILE',
  'GIT_WORK_TREE',
]);

function isGitLocalRepoEnvVar(key: string): boolean {
  const upper = key.toUpperCase();
  return (
    GIT_LOCAL_REPO_ENV_VARS.has(upper) ||
    upper.startsWith('GIT_CONFIG_KEY_') ||
    upper.startsWith('GIT_CONFIG_VALUE_')
  );
}

function environmentWithoutGitLocalRepoVars(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (isGitLocalRepoEnvVar(key)) {
      delete env[key];
    }
  }
  return env;
}

function execGitWithoutLocalRepoEnv(command: string, timeout: number): string {
  return execSync(command, {
    encoding: 'utf-8',
    env: environmentWithoutGitLocalRepoVars(),
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout,
    windowsHide: true,
  });
}

/**
 * Get the latest commit hash from the remote repository.
 * Uses `git ls-remote` to fetch the HEAD commit hash without cloning.
 */
function getLatestCommitHash(): string {
  try {
    const output = execGitWithoutLocalRepoEnv(
      `git ls-remote ${REPO_URL} HEAD`,
      30000 // 30 second timeout
    );
    const hash = output.split('\t')[0];
    if (!hash || hash.length < 10) {
      throw new Error('Invalid commit hash received');
    }
    // Return first 10 characters of the commit hash
    return hash.substring(0, 10);
  } catch (error) {
    throw new Error(
      `Failed to fetch latest commit hash from ${REPO_URL}. Please check your network connection.`
    );
  }
}

/**
 * Clone the repository to the specified path using shallow clone.
 */
function cloneRepo(targetPath: string): void {
  try {
    // Use a temporary path first to avoid race conditions
    const tempPath = `${targetPath}.tmp.${process.pid}`;

    // Clean up any leftover temp directory
    if (existsSync(tempPath)) {
      rmSync(tempPath, { recursive: true, force: true });
    }

    execGitWithoutLocalRepoEnv(
      `git clone --depth 1 ${REPO_URL} "${tempPath}"`,
      120000 // 2 minute timeout for clone
    );

    // Remove .git directory after clone
    const gitDir = join(tempPath, '.git');
    if (existsSync(gitDir)) {
      rmSync(gitDir, { recursive: true, force: true });
    }

    // Atomically move temp directory to final location
    // If targetPath already exists (race condition), just clean up temp
    if (existsSync(targetPath)) {
      rmSync(tempPath, { recursive: true, force: true });
    } else {
      // Rename is atomic on the same filesystem
      try {
        renameSync(tempPath, targetPath);
      } catch {
        // Rename failed - check if another process won the race
        if (existsSync(targetPath)) {
          // Another process created it, clean up our temp
          rmSync(tempPath, { recursive: true, force: true });
        } else {
          // targetPath still doesn't exist - retry once
          try {
            renameSync(tempPath, targetPath);
          } catch (retryError) {
            // Clean up and fail
            rmSync(tempPath, { recursive: true, force: true });
            throw new Error(
              `Failed to move cloned repository to cache location: ${(retryError as Error).message}`
            );
          }
        }
      }
    }
  } catch (error) {
    // Re-throw if it's already our error (from rename failure)
    if (error instanceof Error && error.message.startsWith('Failed to move')) {
      throw error;
    }
    throw new Error(
      `Failed to clone ${REPO_URL}. Please check your network connection.`
    );
  }
}

/**
 * Clean up old cached versions, keeping only the current one.
 */
function cleanupOldCaches(cacheDir: string, currentCommitHash: string): void {
  if (!existsSync(cacheDir)) {
    return;
  }

  try {
    const entries = readdirSync(cacheDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== currentCommitHash) {
        const oldCachePath = join(cacheDir, entry.name);
        rmSync(oldCachePath, { recursive: true, force: true });
      }
    }
  } catch {
    // Ignore cleanup errors - not critical
  }
}

/**
 * Get the path to the cached nx-ai-agents-config repository.
 * Uses a commit-hash based caching strategy:
 * 1. Fetches the latest commit hash from the remote repository
 * 2. Checks if a cached version exists for that hash
 * 3. If not, clones the repository and cleans up old caches
 *
 * @returns The path to the cached repository
 * @throws Error if unable to fetch or clone the repository, or a
 * DirectoryRefusedError if no owner-only cache directory can be established
 */
export function getAiConfigRepoPath(): string {
  const cacheDir = ensureOwnedCacheDir();

  // 1. Get latest commit hash (first 10 chars)
  const commitHash = getLatestCommitHash();

  // 2. Reuse cached version if it still has content (macOS may have
  // swept its files but left the directory tree).
  const cachedPath = join(cacheDir, commitHash);
  if (hasRootFile(cachedPath)) {
    return cachedPath;
  }

  // 3. Wipe any empty skeleton, then clone fresh
  if (existsSync(cachedPath)) {
    rmSync(cachedPath, { recursive: true, force: true });
  }
  cloneRepo(cachedPath);

  // 4. Clean up old cached versions
  cleanupOldCaches(cacheDir, commitHash);

  return cachedPath;
}

/**
 * The cached files are copied into the workspace, so every directory holding
 * them must be owner-only. Falls back to `~/.nx` when the shared tmp root is
 * refused, e.g. because another account created it.
 */
function ensureOwnedCacheDir(): string {
  const shared = ensureSafeSharedRoot(NX_TMP_DIR);
  const sharedCache = join(NX_USER_TMP_DIR, CACHE_DIR_NAME);
  const sharedRefusal =
    shared.status === 'ok'
      ? ownedChainRefusal([NX_USER_TMP_DIR, sharedCache])
      : shared.refusal;
  if (!sharedRefusal) {
    return sharedCache;
  }

  if (NX_HOME_TMP_DIR && !isSharedTmpDir(NX_HOME_TMP_DIR)) {
    const homeCache = join(NX_HOME_TMP_DIR, CACHE_DIR_NAME);
    if (!ownedChainRefusal([NX_HOME_TMP_DIR, homeCache])) {
      return homeCache;
    }
  }
  throw new DirectoryRefusedError(sharedRefusal);
}

function ownedChainRefusal(dirs: string[]): DirRefusal | undefined {
  for (const dir of dirs) {
    const owned = ensureOwnedPrivateDir(dir);
    if (owned.status !== 'ok') {
      return owned.refusal;
    }
  }
  return undefined;
}

/** A `$HOME` of `/tmp` makes `~/.nx` the shared root itself, which must stay 1777. */
function isSharedTmpDir(dir: string): boolean {
  const resolved = canonicalDir(dir);
  return [NX_TMP_DIR, NX_USER_TMP_DIR].some(
    (shared) => canonicalDir(shared) === resolved
  );
}

/**
 * The repo always has at least one regular file at its root (e.g. README).
 * If everything at the root is a directory, the cache was swept by macOS
 * tmp cleanup and we should re-clone.
 */
function hasRootFile(dir: string): boolean {
  try {
    return readdirSync(dir, { withFileTypes: true }).some((e) => e.isFile());
  } catch {
    return false;
  }
}
