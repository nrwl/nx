import { Task } from '../../config/task-graph';
import { TaskProfilingLifeCycle } from './task-profiling-life-cycle';
import { performance } from 'perf_hooks';

describe('TaskProfilingLifeCycle', () => {
  let originalNow: any;
  let mockPerfValue = 0;

  beforeAll(() => {
    originalNow = performance.now;
    Object.defineProperty(performance, 'now', {
      value: jest.fn(),
      configurable: true,
      writable: true,
    });
    jest.spyOn(performance, 'now').mockImplementation(() => mockPerfValue);
  });

  afterAll(() => {
    Object.defineProperty(performance, 'now', {
      value: originalNow,
      configurable: true,
      writable: true,
    });
  });

  it('should produce a profile for 3 different tasks in 2 groups', () => {
    const lifecycle = new TaskProfilingLifeCycle('profile.json');

    const task1: Task = {
      id: 'task-1',
      overrides: undefined,
      target: { project: 'proj-1', target: 'lint' },
    };
    const task2: Task = {
      id: 'task-2',
      overrides: undefined,
      target: { project: 'proj-2', target: 'lint' },
    };
    const task3: Task = {
      id: 'task-3',
      overrides: undefined,
      target: { project: 'proj-1', target: 'test' },
    };
    const group0 = { groupId: 0 };
    const group1 = { groupId: 1 };

    mockPerfValue = 110;
    lifecycle.startTasks([task1], group0);
    lifecycle.startTasks([task2], group1);

    mockPerfValue = 240;
    lifecycle.startTasks([task3], group0);
    lifecycle.endTasks([{ task: task1, status: 'success', code: 0 }], group0);

    mockPerfValue = 300;
    lifecycle.endTasks([{ task: task2, status: 'success', code: 0 }], group1);
    lifecycle.endTasks([{ task: task3, status: 'failure', code: 1 }], group0);

    expect((lifecycle as any).profile).toEqual([
      {
        args: { name: 'Group #1' },
        name: 'thread_name',
        ph: 'M',
        pid: process.pid,
        tid: 0,
        ts: 0,
      },
      {
        args: { name: 'Group #2' },
        name: 'thread_name',
        ph: 'M',
        pid: process.pid,
        tid: 1,
        ts: 0,
      },
      {
        args: {
          status: 'success',
          target: { project: 'proj-1', target: 'lint' },
        },
        cat: 'proj-1,lint',
        dur: 130000,
        name: 'task-1',
        ph: 'X',
        pid: process.pid,
        tid: 0,
        ts: 110000,
      },
      {
        args: {
          status: 'success',
          target: { project: 'proj-2', target: 'lint' },
        },
        cat: 'proj-2,lint',
        dur: 190000,
        name: 'task-2',
        ph: 'X',
        pid: process.pid,
        tid: 1,
        ts: 110000,
      },
      {
        args: {
          status: 'failure',
          target: {
            project: 'proj-1',
            target: 'test',
          },
        },
        cat: 'proj-1,test',
        dur: 60000,
        name: 'task-3',
        ph: 'X',
        pid: process.pid,
        tid: 0,
        ts: 240000,
      },
    ]);
  });
});
