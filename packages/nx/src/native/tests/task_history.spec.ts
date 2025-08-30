import { TaskDetails, NxTaskHistory } from '../index';
import { join } from 'path';
import { TempFs } from '../../internal-testing-utils/temp-fs';
import { rmSync } from 'fs';
import { getDbConnection } from '../../utils/db-connection';
import { randomBytes } from 'crypto';

const dbOutputFolder = 'temp-db-task';
describe('NxTaskHistory', () => {
  let taskHistory: NxTaskHistory;
  let tempFs: TempFs;
  let taskDetails: TaskDetails;

  beforeEach(() => {
    tempFs = new TempFs('task-history');

    const dbConnection = getDbConnection({
      directory: join(__dirname, dbOutputFolder),
      dbName: `temp-db-${randomBytes(4).toString('hex')}`,
    });
    taskHistory = new NxTaskHistory(dbConnection);
    taskDetails = new TaskDetails(dbConnection);

    // Cache sets up the task details
    taskDetails.recordTaskDetails([
      {
        hash: '123',
        project: 'proj',
        target: 'build',
        configuration: 'production',
        cache: true,
      },
      {
        hash: '234',
        project: 'proj',
        target: 'build',
        configuration: 'production',
        cache: true,
      },
    ]);
  });

  afterAll(() => {
    rmSync(join(__dirname, dbOutputFolder), {
      recursive: true,
      force: true,
    });
  });

  it('should record task history', () => {
    taskHistory.recordTaskRuns([
      {
        hash: '123',
        code: 0,
        status: 'success',
        start: Date.now() - 1000 * 60 * 60,
        end: Date.now(),
      },
    ]);
  });

  it('should query flaky tasks', () => {
    taskHistory.recordTaskRuns([
      {
        hash: '123',
        code: 1,
        status: 'failure',
        start: Date.now() - 1000 * 60 * 60,
        end: Date.now(),
      },
      {
        hash: '123',
        code: 0,
        status: 'success',
        start: Date.now() - 1000 * 60 * 60,
        end: Date.now(),
      },
      {
        hash: '234',
        code: 0,
        status: 'success',
        start: Date.now() - 1000 * 60 * 60,
        end: Date.now(),
      },
    ]);
    const r = taskHistory.getFlakyTasks(['123', '234']);
    expect(r).toContain('123');
    expect(r).not.toContain('234');

    const r2 = taskHistory.getFlakyTasks([]);
    expect(r2).not.toContain('123');
    expect(r2).not.toContain('234');
  });

  it('should get estimated task timings', () => {
    taskHistory.recordTaskRuns([
      {
        hash: '123',
        code: 1,
        status: 'failure',
        start: Date.now() - 1000 * 60 * 60,
        end: Date.now(),
      },
      {
        hash: '123',
        code: 0,
        status: 'success',
        start: Date.now() - 1000 * 60 * 60,
        end: Date.now(),
      },
      {
        hash: '234',
        code: 0,
        status: 'success',
        start: Date.now() - 1000 * 60 * 60,
        end: Date.now(),
      },
    ]);
    const r = taskHistory.getEstimatedTaskTimings([
      {
        project: 'proj',
        target: 'build',
        configuration: 'production',
      },
    ]);
    expect(r['proj:build:production']).toEqual(60 * 60 * 1000);
  });

  it('should not consider non-cacheable tasks as flaky', () => {
    // Add tasks with different cache settings that have mixed success/failure
    taskDetails.recordTaskDetails([
      {
        hash: '345',
        project: 'proj',
        target: 'serve',
        configuration: undefined,
        cache: false,
      },
      {
        hash: '456',
        project: 'proj',
        target: 'dev',
        configuration: undefined,
        cache: false, // explicitly non-cacheable
      },
    ]);

    taskHistory.recordTaskRuns([
      // cache: false task
      {
        hash: '345',
        code: 1,
        status: 'failure',
        start: Date.now() - 1000 * 60 * 60,
        end: Date.now(),
      },
      {
        hash: '345',
        code: 0,
        status: 'success',
        start: Date.now() - 1000 * 60 * 60,
        end: Date.now(),
      },
      // cache: null task
      {
        hash: '456',
        code: 1,
        status: 'failure',
        start: Date.now() - 1000 * 60 * 60,
        end: Date.now(),
      },
      {
        hash: '456',
        code: 0,
        status: 'success',
        start: Date.now() - 1000 * 60 * 60,
        end: Date.now(),
      },
    ]);

    const r = taskHistory.getFlakyTasks(['345', '456']);
    expect(r).not.toContain('345'); // Should not be flaky because cache = false
    expect(r).not.toContain('456'); // Should not be flaky because cache = false
  });
});
