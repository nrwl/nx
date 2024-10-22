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
});
