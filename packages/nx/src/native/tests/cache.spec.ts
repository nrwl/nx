import { TaskDetails, NxCache } from '../index';
import { join } from 'path';
import { TempFs } from '../../internal-testing-utils/temp-fs';
import { existsSync, rmSync } from 'fs';
import { getDbConnection } from '../../utils/db-connection';
import { randomBytes } from 'crypto';

describe('Cache', () => {
  let cache: NxCache;
  let dbConnection: ReturnType<typeof getDbConnection>;
  let tempFs: TempFs;
  let taskDetails: TaskDetails;

  const dbOutputFolder = 'temp-db-cache';
  beforeEach(() => {
    tempFs = new TempFs('cache');

    dbConnection = getDbConnection({
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

  it('should remove terminal output files when evicting by cache size', () => {
    taskDetails.recordTaskDetails([
      {
        hash: '456',
        project: 'proj',
        target: 'test',
        configuration: 'production',
      },
    ]);
    const limitedCache = new NxCache(
      tempFs.tempDir,
      join(tempFs.tempDir, '.cache'),
      dbConnection,
      undefined,
      15
    );

    limitedCache.put('123', 'output 123', [], 0);
    limitedCache.put('456', 'output 456', [], 0);

    const hashes = ['123', '456'];
    const cachedHashes = hashes.filter((hash) =>
      existsSync(join(tempFs.tempDir, '.cache', hash))
    );
    const terminalOutputHashes = hashes.filter((hash) =>
      existsSync(limitedCache.getTaskOutputsPath(hash))
    );

    expect(cachedHashes).toHaveLength(1);
    expect(terminalOutputHashes).toEqual(cachedHashes);
  });
});
