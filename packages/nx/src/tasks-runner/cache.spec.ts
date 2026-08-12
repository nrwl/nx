import { DbCache, formatCacheSize, parseMaxCacheSize } from './cache';
import { output } from '../utils/output';
import type { Task } from '../config/task-graph';

const nativeCache = {
  get: jest.fn().mockReturnValue(null),
  getBatch: jest.fn().mockReturnValue([]),
  put: jest.fn().mockReturnValue([]),
  applyRemoteCacheResults: jest.fn(),
  cacheDirectory: '/tmp/nx-cache',
};

jest.mock('../native', () => ({
  IS_WASM: false,
  NxCache: jest.fn().mockImplementation(() => nativeCache),
  HttpRemoteCache: jest.fn(),
  getDefaultMaxCacheSize: jest.fn().mockReturnValue(0),
}));
jest.mock('../utils/db-connection', () => ({ getDbConnection: jest.fn() }));
jest.mock('../config/nx-json', () => ({ readNxJson: jest.fn(() => ({})) }));
jest.mock('./task-io-service', () => ({
  getTaskIOService: () => ({ notifyTaskOutputs: jest.fn() }),
}));
jest.mock('../utils/output', () => ({
  output: { warn: jest.fn(), error: jest.fn(), note: jest.fn() },
}));

/** Mirrors how napi surfaces a fatal error from `cache/errors.rs`. */
function fatalError(message: string): Error {
  return Object.assign(new Error(message), { code: 'InvalidArg' });
}

/** Mirrors a recoverable one — a stalled or unreachable cache server. */
function recoverableError(message: string): Error {
  return Object.assign(new Error(message), { code: 'GenericFailure' });
}

describe('remote cache failures', () => {
  const task = {
    id: 'a:build',
    hash: 'hash1',
    target: { project: 'a', target: 'build' },
    overrides: {},
    outputs: [],
  } as unknown as Task;

  function cacheWithRemote(remote: Record<string, jest.Mock>): DbCache {
    const cache = new DbCache({ nxCloudRemoteCache: null as any });
    (cache as any).remoteCache = remote;
    return cache;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    nativeCache.get.mockReturnValue(null);
    nativeCache.put.mockReturnValue([]);
  });

  it('should treat a failed retrieve as a cache miss', async () => {
    const cache = cacheWithRemote({
      retrieve: jest
        .fn()
        .mockRejectedValue(recoverableError('connection reset')),
      store: jest.fn(),
    });

    await expect(cache.get(task)).resolves.toBeNull();
    expect(output.warn).toHaveBeenCalledTimes(1);
  });

  it('should rethrow a fatal retrieve failure', async () => {
    const cache = cacheWithRemote({
      retrieve: jest.fn().mockRejectedValue(fatalError('unsafe artifact')),
      store: jest.fn(),
    });

    await expect(cache.get(task)).rejects.toThrow('unsafe artifact');
    expect(output.warn).not.toHaveBeenCalled();
  });

  it('should not fail the run when the upload fails', async () => {
    const store = jest.fn().mockRejectedValue(recoverableError('stalled'));
    const cache = cacheWithRemote({ retrieve: jest.fn(), store });

    await expect(cache.put(task, 'output', [], 0)).resolves.toBeUndefined();
    expect(output.warn).toHaveBeenCalledTimes(1);
  });

  it('should rethrow a fatal upload failure', async () => {
    const cache = cacheWithRemote({
      retrieve: jest.fn(),
      store: jest.fn().mockRejectedValue(fatalError('read-only token')),
    });

    await expect(cache.put(task, 'output', [], 0)).rejects.toThrow(
      'read-only token'
    );
  });

  // Regression guard: catching inside tryAndRetry instead of around it would
  // silently remove retries, so a single blip would stop reaching the cache.
  it('should still retry a failing upload before giving up', async () => {
    const store = jest
      .fn()
      .mockRejectedValueOnce(recoverableError('blip'))
      .mockResolvedValueOnce(true);
    const cache = cacheWithRemote({ retrieve: jest.fn(), store });

    await cache.put(task, 'output', [], 0);

    expect(store).toHaveBeenCalledTimes(2);
    expect(output.warn).not.toHaveBeenCalled();
  });

  // A remote outage must not also cost the local cache entry.
  it('should still write locally when the upload fails', async () => {
    const cache = cacheWithRemote({
      retrieve: jest.fn(),
      store: jest.fn().mockRejectedValue(recoverableError('stalled')),
    });

    await cache.put(task, 'output', [], 0);

    expect(nativeCache.put).toHaveBeenCalledTimes(1);
  });
});

describe('cache', () => {
  describe('parseMaxCacheSize', () => {
    it('should support numerical byte values', () => {
      expect(parseMaxCacheSize('0')).toEqual(0);
      expect(parseMaxCacheSize(0)).toEqual(0);
      expect(parseMaxCacheSize('1')).toEqual(1);
      expect(parseMaxCacheSize(1024)).toEqual(1024);
    });

    it('should parse KB', () => {
      expect(parseMaxCacheSize('1KB')).toEqual(1024);
    });

    it('should parse MB', () => {
      expect(parseMaxCacheSize('1MB')).toEqual(1024 * 1024);
    });

    it('should parse GB', () => {
      expect(parseMaxCacheSize('1GB')).toEqual(1024 * 1024 * 1024);
    });

    it('should parse B', () => {
      expect(parseMaxCacheSize('1B')).toEqual(1);
    });

    it('should parse as bytes by default', () => {
      expect(parseMaxCacheSize('1')).toEqual(1);
    });

    it('should handle decimals', () => {
      expect(parseMaxCacheSize('1.5KB')).toEqual(1024 * 1.5);
    });

    it('should error if invalid unit', () => {
      expect(() => parseMaxCacheSize('1ZB')).toThrow();
    });

    it('should error if invalid number', () => {
      expect(() => parseMaxCacheSize('abc')).toThrow();
    });

    it('should error if multiple decimal points', () => {
      expect(() => parseMaxCacheSize('1.5.5KB')).toThrow;
    });
  });

  describe('formatCacheSize', () => {
    it('should format bytes', () => {
      expect(formatCacheSize(1)).toEqual('1.00 B');
    });

    it('should format KB', () => {
      expect(formatCacheSize(1024)).toEqual('1.00 KB');
    });

    it('should format MB', () => {
      expect(formatCacheSize(1024 * 1024)).toEqual('1.00 MB');
    });

    it('should format GB', () => {
      expect(formatCacheSize(1024 * 1024 * 1024)).toEqual('1.00 GB');
    });

    it('should format partial units', () => {
      expect(formatCacheSize(1024 * 88.5)).toEqual('88.50 KB');
    });
  });
});
