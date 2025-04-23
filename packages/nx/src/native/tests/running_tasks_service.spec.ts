import { RunningTasksService, TaskDetails } from '../index';
import { join } from 'path';
import { TempFs } from '../../internal-testing-utils/temp-fs';
import { rmSync } from 'fs';
import { getDbConnection } from '../../utils/db-connection';
import { randomBytes } from 'crypto';

const dbOutputFolder = 'temp-db-task';
describe('RunningTasksService', () => {
  let runningTasksService: RunningTasksService;
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('running-tasks-service');

    const dbConnection = getDbConnection({
      directory: join(__dirname, dbOutputFolder),
      dbName: `temp-db-${randomBytes(4).toString('hex')}`,
    });
    runningTasksService = new RunningTasksService(dbConnection);
  });

  afterAll(() => {
    rmSync(join(__dirname, dbOutputFolder), {
      recursive: true,
      force: true,
    });
  });

  it('should record a task as running', () => {
    runningTasksService.addRunningTask('app:build');
    expect(runningTasksService.getRunningTasks(['app:build'])).toEqual([
      'app:build',
    ]);
  });

  it('should remove a task from running tasks', () => {
    runningTasksService.addRunningTask('app:build');
    runningTasksService.removeRunningTask('app:build');
    expect(runningTasksService.getRunningTasks(['app:build'])).toEqual([]);
  });
});
