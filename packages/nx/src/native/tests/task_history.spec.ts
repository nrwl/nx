import { TaskDetails, NxTaskHistory } from '../index';
import { join } from 'path';
import { TempFs } from '../../internal-testing-utils/temp-fs';
import { rmSync } from 'fs';
import { getDbConnection } from '../../utils/db-connection';

describe('NxTaskHistory', () => {
  let taskHistory: NxTaskHistory;
  let tempFs: TempFs;
  let taskDetails: TaskDetails;

  beforeEach(() => {
    tempFs = new TempFs('task-history');

    rmSync(join(__dirname, 'temp-db'), {
      recursive: true,
      force: true,
    });

    const dbConnection = getDbConnection(join(__dirname, 'temp-db'));
    taskHistory = new NxTaskHistory(dbConnection);
    taskDetails = new TaskDetails(dbConnection);

    // Cache sets up the task details
    taskDetails.recordTaskDetails([
      {
        hash: '123',
        project: 'proj',
        target: 'build',
        configuration: 'production',
      },
      {
        hash: '234',
        project: 'proj',
        target: 'build',
        configuration: 'production',
      },
    ]);
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
});
