"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAiConfigRepoPath = getAiConfigRepoPath;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const REPO_URL = 'https://github.com/nrwl/nx-ai-agents-config';
const CACHE_DIR = (0, path_1.join)((0, os_1.tmpdir)(), 'nx-ai-agents-config');
/**
 * Get the latest commit hash from the remote repository.
 * Uses `git ls-remote` to fetch the HEAD commit hash without cloning.
 */
function getLatestCommitHash() {
    try {
        const output = (0, child_process_1.execSync)(`git ls-remote ${REPO_URL} HEAD`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 30000, // 30 second timeout
            windowsHide: true,
        });
        const hash = output.split('\t')[0];
        if (!hash || hash.length < 10) {
            throw new Error('Invalid commit hash received');
        }
        // Return first 10 characters of the commit hash
        return hash.substring(0, 10);
    }
    catch (error) {
        throw new Error(`Failed to fetch latest commit hash from ${REPO_URL}. Please check your network connection.`);
    }
}
/**
 * Clone the repository to the specified path using shallow clone.
 */
function cloneRepo(targetPath) {
    try {
        // Ensure parent directory exists
        (0, fs_1.mkdirSync)(CACHE_DIR, { recursive: true });
        // Use a temporary path first to avoid race conditions
        const tempPath = `${targetPath}.tmp.${process.pid}`;
        // Clean up any leftover temp directory
        if ((0, fs_1.existsSync)(tempPath)) {
            (0, fs_1.rmSync)(tempPath, { recursive: true, force: true });
        }
        (0, child_process_1.execSync)(`git clone --depth 1 ${REPO_URL} "${tempPath}"`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 120000, // 2 minute timeout for clone
            windowsHide: true,
        });
        // Remove .git directory after clone
        const gitDir = (0, path_1.join)(tempPath, '.git');
        if ((0, fs_1.existsSync)(gitDir)) {
            (0, fs_1.rmSync)(gitDir, { recursive: true, force: true });
        }
        // Atomically move temp directory to final location
        // If targetPath already exists (race condition), just clean up temp
        if ((0, fs_1.existsSync)(targetPath)) {
            (0, fs_1.rmSync)(tempPath, { recursive: true, force: true });
        }
        else {
            // Rename is atomic on the same filesystem
            try {
                (0, fs_1.renameSync)(tempPath, targetPath);
            }
            catch {
                // Rename failed - check if another process won the race
                if ((0, fs_1.existsSync)(targetPath)) {
                    // Another process created it, clean up our temp
                    (0, fs_1.rmSync)(tempPath, { recursive: true, force: true });
                }
                else {
                    // targetPath still doesn't exist - retry once
                    try {
                        (0, fs_1.renameSync)(tempPath, targetPath);
                    }
                    catch (retryError) {
                        // Clean up and fail
                        (0, fs_1.rmSync)(tempPath, { recursive: true, force: true });
                        throw new Error(`Failed to move cloned repository to cache location: ${retryError.message}`);
                    }
                }
            }
        }
    }
    catch (error) {
        // Re-throw if it's already our error (from rename failure)
        if (error instanceof Error && error.message.startsWith('Failed to move')) {
            throw error;
        }
        throw new Error(`Failed to clone ${REPO_URL}. Please check your network connection.`);
    }
}
/**
 * Clean up old cached versions, keeping only the current one.
 */
function cleanupOldCaches(currentCommitHash) {
    if (!(0, fs_1.existsSync)(CACHE_DIR)) {
        return;
    }
    try {
        const entries = (0, fs_1.readdirSync)(CACHE_DIR, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && entry.name !== currentCommitHash) {
                const oldCachePath = (0, path_1.join)(CACHE_DIR, entry.name);
                (0, fs_1.rmSync)(oldCachePath, { recursive: true, force: true });
            }
        }
    }
    catch {
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
function getAiConfigRepoPath() {
    // 1. Get latest commit hash (first 10 chars)
    const commitHash = getLatestCommitHash();
    // 2. Reuse cached version if it still has content (macOS may have
    // swept its files but left the directory tree).
    const cachedPath = (0, path_1.join)(CACHE_DIR, commitHash);
    if (hasRootFile(cachedPath)) {
        return cachedPath;
    }
    // 3. Wipe any empty skeleton, then clone fresh
    if ((0, fs_1.existsSync)(cachedPath)) {
        (0, fs_1.rmSync)(cachedPath, { recursive: true, force: true });
    }
    cloneRepo(cachedPath);
    // 4. Clean up old cached versions
    cleanupOldCaches(commitHash);
    return cachedPath;
}
/**
 * The repo always has at least one regular file at its root (e.g. README).
 * If everything at the root is a directory, the cache was swept by macOS
 * tmp cleanup and we should re-clone.
 */
function hasRootFile(dir) {
    try {
        return (0, fs_1.readdirSync)(dir, { withFileTypes: true }).some((e) => e.isFile());
    }
    catch {
        return false;
    }
}
