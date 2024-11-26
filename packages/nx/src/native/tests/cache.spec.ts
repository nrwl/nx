import { TaskDetails, NxCache } from '../index';
import { join } from 'path';
import { TempFs } from '../../internal-testing-utils/temp-fs';
import { rmSync } from 'fs';
import { getDbConnection } from '../../utils/db-connection';

describe('Cache', () => {
  let cache: NxCache;
  let tempFs: TempFs;
  let taskDetails: TaskDetails;

  beforeEach(() => {
    tempFs = new TempFs('cache');
    rmSync(join(__dirname, 'temp-db'), {
      recursive: true,
      force: true,
    });

    const dbConnection = getDbConnection({
      directory: join(__dirname, 'temp-db'),
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
});
