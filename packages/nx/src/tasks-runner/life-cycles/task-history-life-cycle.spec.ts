import { Task } from '../../config/task-graph';
import { TaskResult } from '../life-cycle';
import { TaskHistoryLifeCycle } from './task-history-life-cycle';

vi.mock('../is-tui-enabled', () => ({ isTuiEnabled: () => false }));

describe('TaskHistoryLifeCycle', () => {
  function createTask(id: string): Task {
    const [project, target] = id.split(':');
    return {
      id,
      target: { project, target },
      overrides: {},
      outputs: [],
      hash: `hash-${id}`,
      startTime: 1,
      endTime: 2,
      cache: true,
      parallelism: true,
    } as Task;
  }

  // Bypass the constructor — it enforces a process-wide singleton and its
  // field initializer opens the task history db.
  function createLifeCycle(taskHistory: object | null = null) {
    const lifeCycle: any = Object.create(TaskHistoryLifeCycle.prototype);
    lifeCycle.startTimings = {};
    lifeCycle.pendingResults = new Map();
    lifeCycle.taskRuns = new Map();
    lifeCycle.taskHistory = taskHistory ?? {
      recordTaskRuns: vi.fn(async () => {}),
      getFlakyTasks: vi.fn(async () => []),
    };
    return lifeCycle;
  }

  it('should not retain terminalOutput on pending results', async () => {
    const lifeCycle = createLifeCycle();
    const task = createTask('proj:build');
    const result: TaskResult = {
      task,
      status: 'success',
      code: 0,
      terminalOutput: 'x'.repeat(1024),
    };

    await lifeCycle.endTasks([result]);

    const pending = Array.from(lifeCycle.pendingResults.values());
    expect(pending).toEqual([{ task, code: 0, status: 'success' }]);
    expect(pending[0]).not.toHaveProperty('terminalOutput');
  });

  it('should record runs and release per-task state on endCommand', async () => {
    const lifeCycle = createLifeCycle();
    const task = createTask('proj:build');
    lifeCycle.startTasks([task]);
    await lifeCycle.endTasks([
      { task, status: 'success', code: 0, terminalOutput: 'out' },
    ]);

    await lifeCycle.endCommand();

    expect(lifeCycle.taskHistory.recordTaskRuns).toHaveBeenCalledWith([
      expect.objectContaining({
        hash: 'hash-proj:build',
        status: 'success',
        code: 0,
      }),
    ]);
    // A long-lived process (Nx Cloud agent) runs many commands; per-task
    // state must not accumulate across them.
    expect(lifeCycle.pendingResults.size).toBe(0);
    expect(lifeCycle.startTimings).toEqual({});
  });

  it('should release pending results on endCommand even without task history', async () => {
    const lifeCycle = createLifeCycle();
    lifeCycle.taskHistory = null;
    const task = createTask('proj:build');
    await lifeCycle.endTasks([
      { task, status: 'success', code: 0, terminalOutput: 'out' },
    ]);

    await lifeCycle.endCommand();

    expect(lifeCycle.pendingResults.size).toBe(0);
  });
});
