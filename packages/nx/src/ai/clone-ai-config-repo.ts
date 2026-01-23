import { execSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const REPO_URL = 'https://github.com/nrwl/nx-ai-agents-config';
const CACHE_DIR = join(tmpdir(), 'nx-ai-agents-config');

/**
 * Get the latest commit hash from the remote repository.
 * Uses `git ls-remote` to fetch the HEAD commit hash without cloning.
 */
function getLatestCommitHash(): string {
  try {
    const output = execSync(`git ls-remote ${REPO_URL} HEAD`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000, // 30 second timeout
    });
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
    // Ensure parent directory exists
    mkdirSync(CACHE_DIR, { recursive: true });

    // Use a temporary path first to avoid race conditions
    const tempPath = `${targetPath}.tmp.${process.pid}`;

    // Clean up any leftover temp directory
    if (existsSync(tempPath)) {
      rmSync(tempPath, { recursive: true, force: true });
    }

    execSync(
      `git clone --depth 1 -b generated-agents-config ${REPO_URL} "${tempPath}"`,
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 120000, // 2 minute timeout for clone
      }
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
function cleanupOldCaches(currentCommitHash: string): void {
  if (!existsSync(CACHE_DIR)) {
    return;
  }

  try {
    const entries = readdirSync(CACHE_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== currentCommitHash) {
        const oldCachePath = join(CACHE_DIR, entry.name);
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
 * @throws Error if unable to fetch or clone the repository
 */
export function getAiConfigRepoPath(): string {
  // 1. Get latest commit hash (first 10 chars)
  const commitHash = getLatestCommitHash();

  // 2. Check if cached version exists
  const cachedPath = join(CACHE_DIR, commitHash);
  if (existsSync(cachedPath)) {
    return cachedPath;
  }

  // 3. Clone fresh
  cloneRepo(cachedPath);

  // 4. Clean up old cached versions
  cleanupOldCaches(commitHash);

  return cachedPath;
}
