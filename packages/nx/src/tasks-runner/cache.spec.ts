import type { Mock } from 'vitest';
import type { Task } from '../config/task-graph';
import { output } from '../utils/output';
import {
  DbCache,
  formatCacheSize,
  parseMaxCacheSize,
  remoteCacheRetrieveConcurrency,
} from './cache';

const nativeCache = vi.hoisted(() => ({
  cacheDirectory: '/cache',
  get: vi.fn(),
  getBatch: vi.fn(),
  put: vi.fn().mockReturnValue([]),
  applyRemoteCacheResults: vi.fn(),
}));

vi.mock('../native', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../native')>()),
  NxCache: vi.fn(function () {
    return nativeCache;
  }),
}));
vi.mock('../utils/db-connection', () => ({ getDbConnection: () => 'db' }));
vi.mock('../config/nx-json', () => ({ readNxJson: () => ({}) }));
vi.mock('./task-io-service', () => ({
  getTaskIOService: () => ({ notifyTaskOutputs: vi.fn() }),
}));
vi.mock('../utils/output', () => ({
  output: { warn: vi.fn(), error: vi.fn(), note: vi.fn() },
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

  function cacheWithRemote(remote: Record<string, Mock>): DbCache {
    const cache = new DbCache({ nxCloudRemoteCache: null as any });
    (cache as any).remoteCache = remote;
    return cache;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    nativeCache.get.mockReturnValue(null);
    nativeCache.put.mockReturnValue([]);
  });

  it('should treat a failed retrieve as a cache miss', async () => {
    const cache = cacheWithRemote({
      retrieve: vi.fn().mockRejectedValue(recoverableError('connection reset')),
      store: vi.fn(),
    });

    await expect(cache.get(task)).resolves.toBeNull();
    expect(output.warn).toHaveBeenCalledTimes(1);
  });

  it('should rethrow a fatal retrieve failure', async () => {
    const cache = cacheWithRemote({
      retrieve: vi.fn().mockRejectedValue(fatalError('unsafe artifact')),
      store: vi.fn(),
    });

    await expect(cache.get(task)).rejects.toThrow('unsafe artifact');
    expect(output.warn).not.toHaveBeenCalled();
  });

  it('should not fail the run when the upload fails', async () => {
    const store = vi.fn().mockRejectedValue(recoverableError('stalled'));
    const cache = cacheWithRemote({ retrieve: vi.fn(), store });

    await expect(cache.put(task, 'output', [], 0)).resolves.toBeUndefined();
    expect(output.warn).toHaveBeenCalledTimes(1);
  });

  it('should rethrow a fatal upload failure', async () => {
    const cache = cacheWithRemote({
      retrieve: vi.fn(),
      store: vi.fn().mockRejectedValue(fatalError('read-only token')),
    });

    await expect(cache.put(task, 'output', [], 0)).rejects.toThrow(
      'read-only token'
    );
  });

  // Regression guard: catching inside tryAndRetry instead of around it would
  // silently remove retries, so a single blip would stop reaching the cache.
  it('should still retry a failing upload before giving up', async () => {
    const store = vi
      .fn()
      .mockRejectedValueOnce(recoverableError('blip'))
      .mockResolvedValueOnce(true);
    const cache = cacheWithRemote({ retrieve: vi.fn(), store });

    await cache.put(task, 'output', [], 0);

    expect(store).toHaveBeenCalledTimes(2);
    expect(output.warn).not.toHaveBeenCalled();
  });

  // A remote outage must not also cost the local cache entry.
  it('should still write locally when the upload fails', async () => {
    const cache = cacheWithRemote({
      retrieve: vi.fn(),
      store: vi.fn().mockRejectedValue(recoverableError('stalled')),
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
      expect(() => parseMaxCacheSize('1.5.5KB')).toThrow();
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

  describe('remoteCacheRetrieveConcurrency', () => {
    it('should follow --parallel and stay inside the default and upper bound', () => {
      expect(remoteCacheRetrieveConcurrency(undefined)).toEqual(10);
      expect(remoteCacheRetrieveConcurrency(1)).toEqual(1);
      expect(remoteCacheRetrieveConcurrency(4)).toEqual(4);
      expect(remoteCacheRetrieveConcurrency(10.9)).toEqual(10);
      expect(remoteCacheRetrieveConcurrency(0)).toEqual(1);
      expect(remoteCacheRetrieveConcurrency(10_000)).toEqual(16);
    });
  });

  describe('DbCache.getBatch', () => {
    function task(hash: string): Task {
      return {
        id: hash,
        target: { project: 'app', target: 'lint' },
        overrides: {},
        outputs: [],
        hash,
        cache: true,
      };
    }

    async function maxInFlightRetrieves(
      parallel: number,
      taskCount: number
    ): Promise<{ maxInFlight: number; calls: number; hits: number }> {
      const limit = remoteCacheRetrieveConcurrency(parallel);
      const db = new DbCache({
        nxCloudRemoteCache: null,
        parallel,
      });
      const applied: string[] = [];
      (db as any).cache = {
        cacheDirectory: '/tmp/nx-cache-spec',
        getBatch: (hashes: string[]) => hashes.map(() => null),
        applyRemoteCacheResults: (
          hash: string,
          res: { terminalOutput: string }
        ) => {
          applied.push(hash);
          return res.terminalOutput;
        },
      };

      let inFlight = 0;
      let maxInFlight = 0;
      let started = 0;
      let release = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const retrieve = vi.fn(async (hash: string) => {
        started++;
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await gate;
        inFlight--;
        if (hash.endsWith('0')) {
          return {
            code: 0,
            terminalOutput: hash,
            outputsPath: '/tmp/out',
          };
        }
        return null;
      });
      (db as any).remoteCache = { retrieve };

      const tasks = Array.from({ length: taskCount }, (_, i) =>
        task(`hash-${i}`)
      );
      const pending = db.getBatch(tasks);
      const deadline = Date.now() + 2000;
      while (started < limit) {
        if (Date.now() > deadline) {
          throw new Error(
            `timed out with ${started} in-flight retrieves, limit ${limit}`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      // A tick lets an unbounded Promise.all start the rest before we sample.
      await new Promise((resolve) => setImmediate(resolve));
      const observed = maxInFlight;
      release();
      const results = await pending;

      let hits = 0;
      for (const t of tasks) {
        if (t.hash.endsWith('0')) {
          hits++;
          expect(results.get(t.hash)?.remote).toEqual(true);
          expect(results.get(t.hash)?.terminalOutput).toEqual(t.hash);
        } else {
          expect(results.has(t.hash)).toEqual(false);
        }
      }
      expect(applied).toHaveLength(hits);
      expect(retrieve).toHaveBeenCalledTimes(taskCount);
      return { maxInFlight: observed, calls: retrieve.mock.calls.length, hits };
    }

    it('should keep in-flight remote retrieves within the configured limit', async () => {
      const limit = remoteCacheRetrieveConcurrency(4);
      const { maxInFlight } = await maxInFlightRetrieves(4, 12);
      expect(maxInFlight).toBeLessThanOrEqual(limit);
      expect(maxInFlight).toEqual(limit);
    });

    it('should cap in-flight remote retrieves when --parallel exceeds the upper bound', async () => {
      const limit = remoteCacheRetrieveConcurrency(10_000);
      const { maxInFlight } = await maxInFlightRetrieves(10_000, 40);
      expect(limit).toEqual(16);
      expect(maxInFlight).toBeLessThanOrEqual(limit);
      expect(maxInFlight).toEqual(limit);
    });
  });

  describe('DbCache remote hits', () => {
    const artifact = {
      code: 0,
      terminalOutput: 'raw\x1b]52;c;Y3VybA==\x07',
      outputsPath: '/cache/a',
    };
    const task = (hash: string) => ({ hash, outputs: [] }) as unknown as Task;

    function cacheWithRemote() {
      const cache = new DbCache({ nxCloudRemoteCache: null });
      (cache as any).remoteCache = {
        retrieve: vi.fn().mockResolvedValue({ ...artifact }),
      };
      return cache;
    }

    beforeEach(() => {
      vi.clearAllMocks();
      nativeCache.get.mockReturnValue(null);
      nativeCache.getBatch.mockImplementation((hashes: string[]) =>
        hashes.map(() => null)
      );
      nativeCache.applyRemoteCacheResults.mockReturnValue('filtered');
    });

    it('get returns the terminal output as stored by the native cache', async () => {
      const result = await cacheWithRemote().get(task('a'));

      expect(nativeCache.applyRemoteCacheResults).toHaveBeenCalledWith(
        'a',
        expect.objectContaining({ terminalOutput: artifact.terminalOutput }),
        []
      );
      expect(result).toMatchObject({
        terminalOutput: 'filtered',
        remote: true,
      });
    });

    it('getBatch returns the terminal output as stored by the native cache', async () => {
      const results = await cacheWithRemote().getBatch([task('a'), task('b')]);

      expect(nativeCache.applyRemoteCacheResults).toHaveBeenCalledTimes(2);
      for (const hash of ['a', 'b']) {
        expect(results.get(hash)).toMatchObject({
          terminalOutput: 'filtered',
          remote: true,
        });
      }
    });
  });
});
