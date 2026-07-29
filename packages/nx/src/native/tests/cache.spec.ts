import { TaskDetails, NxCache } from '../index';
import { join } from 'path';
import { TempFs } from '../../internal-testing-utils/temp-fs';
import { rmSync } from 'fs';
import { getDbConnection } from '../../utils/db-connection';
import { randomBytes } from 'crypto';

describe('Cache', () => {
  let cache: NxCache;
  let tempFs: TempFs;
  let taskDetails: TaskDetails;

  const dbOutputFolder = 'temp-db-cache';
  beforeEach(() => {
    tempFs = new TempFs('cache');

    const dbConnection = getDbConnection({
      directory: join(__dirname, dbOutputFolder),
      dbName: `temp-db-${randomBytes(4).toString('hex')}`,
    });
    taskDetails = new TaskDetails(dbConnection);

    cache = new NxCache(
      tempFs.tempDir,
      join(tempFs.tempDir, '.cache'),
      dbConnection
    );

    taskDetails.recordTaskDetails([
      {
        hash: '123',
        project: 'proj',
        target: 'test',
        configuration: 'production',
      },
    ]);
  });

  afterAll(() => {
    rmSync(join(__dirname, dbOutputFolder), {
      recursive: true,
      force: true,
    });
  });

  it('should store results into cache', async () => {
    const result = cache.get('123');

    expect(result).toBeNull();

    tempFs.createFileSync('dist/output.txt', 'output contents 123');

    cache.put('123', 'output 123', ['dist'], 0);

    tempFs.removeFileSync('dist/output.txt');

    const result2 = cache.get('123');
    cache.copyFilesFromCache(result2, ['dist']);

    expect(result2.code).toEqual(0);
    expect(result2.terminalOutput).toEqual('output 123');

    expect(await tempFs.readFile('dist/output.txt')).toEqual(
      'output contents 123'
    );
  });

  it('should handle storing hashes that already exist in the cache', async () => {
    cache.put('123', 'output 123', ['dist'], 0);
    expect(() => cache.put('123', 'output 123', ['dist'], 0)).not.toThrow();
  });

  describe('terminal output records', () => {
    it('should not serve a recorded terminal output as a cache hit', () => {
      // There are no artifacts behind this hash — only a terminal output file
      // that the GC needs to know about. Replaying it would restore nothing
      // while reporting a hit.
      cache.recordTerminalOutputs([{ hash: '123', size: 10 }]);

      expect(cache.get('123')).toBeNull();
    });

    it('should count a recorded terminal output against the cache size', () => {
      cache.recordTerminalOutputs([{ hash: '123', size: 10 }]);

      expect(cache.getCacheSize()).toEqual(10);
    });

    it('should let a real cache entry supersede a recorded terminal output', () => {
      cache.recordTerminalOutputs([{ hash: '123', size: 10 }]);
      tempFs.createFileSync('dist/output.txt', 'output contents 123');

      cache.put('123', 'output 123', ['dist'], 0);

      const result = cache.get('123');
      expect(result).not.toBeNull();
      expect(result.terminalOutput).toEqual('output 123');
    });

    it('should not let a recorded terminal output demote a real cache entry', () => {
      tempFs.createFileSync('dist/output.txt', 'output contents 123');
      cache.put('123', 'output 123', ['dist'], 0);

      // A later --skip-nx-cache run writes the terminal output again; the
      // cache entry it would otherwise clobber is still a valid hit.
      cache.recordTerminalOutputs([{ hash: '123', size: 10 }]);

      const result = cache.get('123');
      expect(result).not.toBeNull();
      expect(result.terminalOutput).toEqual('output 123');
    });

    it('should not resize a real cache entry when its output is rewritten', () => {
      tempFs.createFileSync('dist/output.txt', 'output contents 123');
      cache.put('123', 'output 123', ['dist'], 0);
      const sizeWithArtifacts = cache.getCacheSize();

      // The entry's size covers its artifacts; a bare terminal output rewrite
      // must not replace it with the size of the output alone.
      cache.recordTerminalOutputs([{ hash: '123', size: 1 }]);

      expect(cache.getCacheSize()).toEqual(sizeWithArtifacts);
    });

    it('should ignore an empty batch', () => {
      expect(() => cache.recordTerminalOutputs([])).not.toThrow();
    });
  });
});
