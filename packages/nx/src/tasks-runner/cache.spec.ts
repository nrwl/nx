import { Task } from '../config/task-graph';
import { logger } from '../utils/logger';
import { DbCache, formatCacheSize, parseMaxCacheSize } from './cache';

vi.mock('./task-io-service', () => ({
  getTaskIOService: () => ({ notifyTaskOutputs: vi.fn() }),
}));

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

  describe('DbCache.put', () => {
    const task = {
      id: 'my-lib:build',
      target: { project: 'my-lib', target: 'build' },
      overrides: {},
      hash: 'hash-1',
      outputs: ['dist/libs/my-lib'],
      parallelism: true,
    } as Task;

    // The class fields of DbCache open the local cache database and read the
    // workspace configuration, so these tests drive an instance whose local
    // and remote caches are stubs.
    function createDbCache(options: {
      localPut?: () => string[];
      store?: () => Promise<boolean>;
    }) {
      const localPut = vi.fn(options.localPut ?? (() => ['dist/libs/my-lib']));
      const store = vi.fn(options.store ?? (async () => true));
      const dbCache: DbCache = Object.assign(Object.create(DbCache.prototype), {
        cache: { put: localPut, cacheDirectory: '/cache' },
        remoteCache: { store },
      });

      return { dbCache, localPut, store };
    }

    beforeEach(() => {
      // tryAndRetry backs off for up to ~20s between attempts.
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('should warn and continue when the remote write of a task that passed cannot complete', async () => {
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      const { dbCache, localPut, store } = createDbCache({
        store: async () => {
          throw new Error('Failed to send request');
        },
      });

      const put = dbCache.put(task, 'terminal output', task.outputs, 0);
      await vi.runAllTimersAsync();
      await expect(put).resolves.toBeUndefined();

      expect(store).toHaveBeenCalledTimes(6);
      expect(localPut).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        'Remote cache write skipped for hash-1: Failed to send request'
      );
    });

    it('should not warn or repeat the local write when the remote write succeeds on a later attempt', async () => {
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      let attempts = 0;
      const { dbCache, localPut, store } = createDbCache({
        store: async () => {
          if (++attempts < 3) {
            throw new Error('Failed to send request');
          }
          return true;
        },
      });

      const put = dbCache.put(task, 'terminal output', task.outputs, 0);
      await vi.runAllTimersAsync();
      await expect(put).resolves.toBeUndefined();

      expect(store).toHaveBeenCalledTimes(3);
      expect(localPut).toHaveBeenCalledTimes(1);
      expect(warn).not.toHaveBeenCalled();
    });

    it('should reject when the remote write of a task that failed cannot complete', async () => {
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      const { dbCache, store } = createDbCache({
        store: async () => {
          throw new Error('Failed to send request');
        },
      });

      const put = dbCache.put(task, 'terminal output', task.outputs, 1);
      const rejection = expect(put).rejects.toThrow('Failed to send request');
      await vi.runAllTimersAsync();
      await rejection;

      expect(store).toHaveBeenCalledTimes(6);
      expect(warn).not.toHaveBeenCalled();
    });

    it('should reject when the local write cannot complete', async () => {
      const { dbCache, localPut, store } = createDbCache({
        localPut: () => {
          throw new Error('Failed to write the local cache');
        },
      });

      const put = dbCache.put(task, 'terminal output', task.outputs, 0);
      const rejection = expect(put).rejects.toThrow(
        'Failed to write the local cache'
      );
      await vi.runAllTimersAsync();
      await rejection;

      expect(localPut).toHaveBeenCalledTimes(6);
      expect(store).not.toHaveBeenCalled();
    });
  });
});
