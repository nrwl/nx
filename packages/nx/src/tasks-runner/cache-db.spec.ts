import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Create a stable temp dir that can be used by module-level mocks
const stableTmpDir = realpathSync(
  mkdtempSync(join(tmpdir(), 'nx-cache-test-'))
);

// --- Mock setup (must come before imports of code under test) ---

const mockNxCacheInstance = {
  cacheDirectory: stableTmpDir,
  get: jest.fn(),
  put: jest.fn(),
  applyRemoteCacheResults: jest.fn(),
  getTaskOutputsPath: jest.fn(),
  getCacheSize: jest.fn().mockReturnValue(0),
  copyFilesFromCache: jest.fn().mockReturnValue(0),
  removeOldCacheRecords: jest.fn(),
  checkCacheFsInSync: jest.fn().mockReturnValue(true),
};

jest.mock('../native', () => ({
  NxCache: jest.fn().mockImplementation(() => mockNxCacheInstance),
  IS_WASM: false,
  getDefaultMaxCacheSize: jest.fn().mockReturnValue(100 * 1024 * 1024),
  HttpRemoteCache: jest.fn(),
}));

jest.mock('../config/nx-json', () => ({
  readNxJson: jest.fn().mockReturnValue({}),
  NxJsonConfiguration: {},
}));

jest.mock('../utils/db-connection', () => ({
  getDbConnection: jest.fn().mockReturnValue({}),
}));

jest.mock('../utils/cache-directory', () => ({
  cacheDir: stableTmpDir,
  workspaceDataDirectory: stableTmpDir,
  workspaceDataDirectoryForWorkspace: () => stableTmpDir,
}));

jest.mock('../utils/workspace-root', () => ({
  workspaceRoot: stableTmpDir,
}));

jest.mock('../utils/nx-cloud-utils', () => ({
  isNxCloudUsed: jest.fn().mockReturnValue(false),
}));

jest.mock('../utils/is-ci', () => ({
  isCI: jest.fn().mockReturnValue(false),
}));

jest.mock('../utils/output', () => ({
  output: {
    warn: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    verbose: jest.fn(),
  },
}));

import { DbCache } from './cache';
import { logger } from '../utils/logger';
import { RemoteCacheV2 } from './default-tasks-runner';

function createTask(
  id: string,
  hash: string,
  outputs: string[] = ['dist/packages/my-lib']
) {
  return {
    id,
    hash,
    target: {
      project: id.split(':')[0],
      target: id.split(':')[1] || 'build',
    },
    overrides: {},
    outputs,
  } as any;
}

describe('DbCache race condition fixes', () => {
  let dbCache: DbCache;
  let mockRemoteCache: jest.Mocked<RemoteCacheV2>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNxCacheInstance.cacheDirectory = stableTmpDir;

    mockRemoteCache = {
      retrieve: jest.fn(),
      store: jest.fn().mockResolvedValue(true),
    } as any;

    dbCache = new DbCache({
      nxCloudRemoteCache: null,
      skipRemoteCache: false,
    });
    // Inject the mock remote cache (bypass the async getRemoteCache flow)
    (dbCache as any).remoteCache = mockRemoteCache;
  });

  afterAll(() => {
    try {
      rmSync(stableTmpDir, { recursive: true, force: true });
    } catch {}
  });

  describe('put() - local cache eviction guard', () => {
    it('should skip remote store if local cache entry was evicted by cleanup', async () => {
      const task = createTask('my-lib:build', 'evicted-hash-1');

      // Mock cache.put() to NOT create the local directory
      // (simulating maxCacheSize cleanup evicting the entry immediately)
      mockNxCacheInstance.put.mockImplementation(() => {
        // Don't create the cache dir — simulating eviction
      });

      await dbCache.put(task, 'build output', ['dist/packages/my-lib'], 0);

      // remote store should NOT have been called because local entry was evicted
      expect(mockRemoteCache.store).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('evicted by maxCacheSize')
      );
    });

    it('should proceed with remote store if local cache entry exists', async () => {
      const task = createTask('my-lib:build', 'valid-hash-1');

      // Mock cache.put() to create the local directory
      mockNxCacheInstance.put.mockImplementation(() => {
        mkdirSync(join(stableTmpDir, 'valid-hash-1'), { recursive: true });
      });

      await dbCache.put(task, 'build output', ['dist/packages/my-lib'], 0);

      // remote store should have been called
      expect(mockRemoteCache.store).toHaveBeenCalledWith(
        'valid-hash-1',
        stableTmpDir,
        'build output',
        0
      );
      expect(logger.warn).not.toHaveBeenCalled();

      // Cleanup
      rmSync(join(stableTmpDir, 'valid-hash-1'), {
        recursive: true,
        force: true,
      });
    });

    it('should not warn or skip when there is no remote cache', async () => {
      const task = createTask('my-lib:build', 'no-remote-hash');
      (dbCache as any).remoteCache = null;

      mockNxCacheInstance.put.mockImplementation(() => {
        // Don't create the cache dir
      });

      await dbCache.put(task, 'build output', ['dist/packages/my-lib'], 0);

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('get() - stale remote cache detection', () => {
    it('should return null if remote cache outputs path does not exist', async () => {
      const task = createTask('my-lib:build', 'stale-hash-1');

      // Local cache miss
      mockNxCacheInstance.get.mockReturnValue(null);

      // Remote cache "hit" but outputs path points to nonexistent dir
      mockRemoteCache.retrieve.mockResolvedValue({
        code: 0,
        terminalOutput: 'cached output',
        outputsPath: join(stableTmpDir, 'stale-hash-1', 'does-not-exist'),
      });

      const result = await dbCache.get(task);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('cached output files are missing')
      );
      // applyRemoteCacheResults should NOT have been called
      expect(
        mockNxCacheInstance.applyRemoteCacheResults
      ).not.toHaveBeenCalled();
    });

    it('should return null if remote cache outputs path is empty', async () => {
      const task = createTask('my-lib:build', 'empty-hash-1');

      // Local cache miss
      mockNxCacheInstance.get.mockReturnValue(null);

      // Create an empty outputs directory
      const outputsPath = join(stableTmpDir, 'empty-hash-1', 'outputs');
      mkdirSync(outputsPath, { recursive: true });

      mockRemoteCache.retrieve.mockResolvedValue({
        code: 0,
        terminalOutput: 'cached output',
        outputsPath,
      });

      const result = await dbCache.get(task);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('cached output files are missing')
      );

      // Cleanup
      rmSync(join(stableTmpDir, 'empty-hash-1'), {
        recursive: true,
        force: true,
      });
    });

    it('should return cache result if remote cache outputs path has content', async () => {
      const task = createTask('my-lib:build', 'good-hash-1');

      // Local cache miss
      mockNxCacheInstance.get.mockReturnValue(null);

      // Create outputs directory with content
      const outputsPath = join(stableTmpDir, 'good-hash-1', 'outputs');
      mkdirSync(outputsPath, { recursive: true });
      writeFileSync(join(outputsPath, 'index.js'), 'console.log("hello")');

      mockRemoteCache.retrieve.mockResolvedValue({
        code: 0,
        terminalOutput: 'cached output',
        outputsPath,
      });

      const result = await dbCache.get(task);

      expect(result).not.toBeNull();
      expect(result.remote).toBe(true);
      expect(result.terminalOutput).toBe('cached output');
      expect(mockNxCacheInstance.applyRemoteCacheResults).toHaveBeenCalled();

      // Cleanup
      rmSync(join(stableTmpDir, 'good-hash-1'), {
        recursive: true,
        force: true,
      });
    });

    it('should skip validation for tasks with no expected outputs', async () => {
      const task = createTask('my-lib:build', 'no-outputs-hash', []);

      mockNxCacheInstance.get.mockReturnValue(null);

      // Remote cache hit with nonexistent path, but task has no outputs
      mockRemoteCache.retrieve.mockResolvedValue({
        code: 0,
        terminalOutput: 'cached output',
        outputsPath: join(stableTmpDir, 'nonexistent'),
      });

      const result = await dbCache.get(task);

      // Should still return the result since no file outputs were expected
      expect(result).not.toBeNull();
      expect(result.remote).toBe(true);
    });

    it('should skip validation for failed tasks (code !== 0)', async () => {
      const task = createTask('my-lib:build', 'failed-hash-1');

      mockNxCacheInstance.get.mockReturnValue(null);

      // Remote cache hit for a failed task (no outputs expected)
      mockRemoteCache.retrieve.mockResolvedValue({
        code: 1,
        terminalOutput: 'build failed',
        outputsPath: join(stableTmpDir, 'nonexistent'),
      });

      const result = await dbCache.get(task);

      // Should return result even though path doesn't exist (failed tasks have no outputs)
      expect(result).not.toBeNull();
      expect(result.code).toBe(1);
    });

    it('should return local cache results without remote validation', async () => {
      const task = createTask('my-lib:build', 'local-hash-1');

      // Local cache hit
      mockNxCacheInstance.get.mockReturnValue({
        code: 0,
        terminalOutput: 'local cached output',
        outputsPath: join(stableTmpDir, 'local-hash-1'),
      });

      const result = await dbCache.get(task);

      expect(result).not.toBeNull();
      expect(result.remote).toBe(false);
      // Should not hit remote cache at all
      expect(mockRemoteCache.retrieve).not.toHaveBeenCalled();
    });
  });
});
