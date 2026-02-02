import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { dirSync } from 'tmp';

import {
  isGitWorktree,
  getMainRepoRoot,
  cacheDirectoryForWorkspace,
  workspaceDataDirectoryForWorkspace,
} from './cache-directory';

describe('cache-directory', () => {
  describe('isGitWorktree', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = dirSync({ unsafeCleanup: true }).name;
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('should return false when .git does not exist', () => {
      expect(isGitWorktree(tempDir)).toBe(false);
    });

    it('should return false when .git is a directory (main repo)', () => {
      mkdirSync(join(tempDir, '.git'));
      expect(isGitWorktree(tempDir)).toBe(false);
    });

    it('should return true when .git is a file (worktree)', () => {
      writeFileSync(
        join(tempDir, '.git'),
        'gitdir: /some/path/.git/worktrees/branch'
      );
      expect(isGitWorktree(tempDir)).toBe(true);
    });
  });

  describe('getMainRepoRoot', () => {
    // Note: These tests require an actual git worktree setup.
    // We test the basic case where the function is called on a non-git directory.
    let tempDir: string;

    beforeEach(() => {
      tempDir = dirSync({ unsafeCleanup: true }).name;
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('should return null for non-git directory', () => {
      expect(getMainRepoRoot(tempDir)).toBe(null);
    });
  });

  describe('cacheDirectoryForWorkspace', () => {
    const originalEnv = { ...process.env };
    let tempDir: string;

    beforeEach(() => {
      tempDir = dirSync({ unsafeCleanup: true }).name;
      // Reset env vars that affect cache directory
      delete process.env.NX_CACHE_DIRECTORY;
      delete process.env.CI;
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
      process.env = { ...originalEnv };
    });

    it('should return default cache directory for non-worktree', () => {
      mkdirSync(join(tempDir, '.git')); // Main repo (directory, not file)
      writeFileSync(join(tempDir, 'nx.json'), '{}');

      const result = cacheDirectoryForWorkspace(tempDir);
      expect(result).toBe(join(tempDir, '.nx', 'cache'));
    });

    it('should respect NX_CACHE_DIRECTORY env var', () => {
      process.env.NX_CACHE_DIRECTORY = '/custom/cache/path';
      writeFileSync(join(tempDir, 'nx.json'), '{}');

      const result = cacheDirectoryForWorkspace(tempDir);
      expect(result).toBe('/custom/cache/path');
    });

    it('should respect cacheDirectory in nx.json', () => {
      mkdirSync(join(tempDir, '.git'));
      writeFileSync(
        join(tempDir, 'nx.json'),
        JSON.stringify({ cacheDirectory: 'custom-cache' })
      );

      const result = cacheDirectoryForWorkspace(tempDir);
      expect(result).toBe(join(tempDir, 'custom-cache'));
    });

    it('should skip worktree cache sharing in CI', () => {
      process.env.CI = 'true';
      // Simulate worktree by creating .git file
      writeFileSync(
        join(tempDir, '.git'),
        'gitdir: /some/path/.git/worktrees/branch'
      );
      writeFileSync(join(tempDir, 'nx.json'), '{}');

      const result = cacheDirectoryForWorkspace(tempDir);
      // In CI, should fall back to local cache even if it's a worktree
      expect(result).toBe(join(tempDir, '.nx', 'cache'));
    });
  });

  describe('workspaceDataDirectoryForWorkspace', () => {
    const originalEnv = { ...process.env };
    let tempDir: string;

    beforeEach(() => {
      tempDir = dirSync({ unsafeCleanup: true }).name;
      // Reset env vars that affect workspace data directory
      delete process.env.NX_WORKSPACE_DATA_DIRECTORY;
      delete process.env.NX_PROJECT_GRAPH_CACHE_DIRECTORY;
      delete process.env.CI;
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
      process.env = { ...originalEnv };
    });

    it('should return default workspace data directory for non-worktree', () => {
      mkdirSync(join(tempDir, '.git')); // Main repo (directory, not file)
      writeFileSync(join(tempDir, 'nx.json'), '{}');

      const result = workspaceDataDirectoryForWorkspace(tempDir);
      expect(result).toBe(join(tempDir, '.nx', 'workspace-data'));
    });

    it('should respect NX_WORKSPACE_DATA_DIRECTORY env var', () => {
      process.env.NX_WORKSPACE_DATA_DIRECTORY = '/custom/data/path';
      writeFileSync(join(tempDir, 'nx.json'), '{}');

      const result = workspaceDataDirectoryForWorkspace(tempDir);
      expect(result).toBe('/custom/data/path');
    });

    it('should always use local workspace data directory even for worktrees', () => {
      // Workspace-data is intentionally NOT shared between worktrees.
      // The daemon tracks output hashes per-workspace, so sharing would
      // cause incorrect cache hit detection.
      writeFileSync(
        join(tempDir, '.git'),
        'gitdir: /some/path/.git/worktrees/branch'
      );
      writeFileSync(join(tempDir, 'nx.json'), '{}');

      const result = workspaceDataDirectoryForWorkspace(tempDir);
      // Should use local workspace-data, not shared with main repo
      expect(result).toBe(join(tempDir, '.nx', 'workspace-data'));
    });
  });
});
