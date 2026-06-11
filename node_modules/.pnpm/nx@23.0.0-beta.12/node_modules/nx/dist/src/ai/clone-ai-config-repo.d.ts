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
export declare function getAiConfigRepoPath(): string;
