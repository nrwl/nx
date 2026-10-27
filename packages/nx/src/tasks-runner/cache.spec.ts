import { Task } from '../config/task-graph';
import { DbCache, formatCacheSize, parseMaxCacheSize } from './cache';

const nativeCache = vi.hoisted(() => ({
  cacheDirectory: '/cache',
  get: vi.fn(),
  getBatch: vi.fn(),
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
