import defaultTaskRunner from './default-tasks-runner';
import { AffectedEventType, Task } from './tasks-runner';
jest.mock('npm-run-all', () => jest.fn());
import * as runAll from 'npm-run-all';
jest.mock('../command-line/shared', () => ({
  cliCommand: () => 'nx'
}));
jest.mock('../utils/fileutils', () => ({
  readJsonFile: () => ({
    scripts: {
      nx: 'nx'
    }
  })
}));

describe('defaultTasksRunner', () => {
  const tasks = [
    {
      id: 'task-1',
      target: {
        project: 'app-1',
        target: 'target'
      },
      overrides: {}
    },
    {
      id: 'task-2',
      target: {
        project: 'app-2',
        target: 'target'
      },
      overrides: {}
    }
  ];

  const context = {
    dependencyGraph: {
      projects: {
        'app-1': { architect: { target: {} } },
        'app-2': { architect: { target: {} } }
      },
      dependencies: {
        'app-1': [],
        'app-2': []
      },
      roots: ['app-1', 'app-2']
    },
    tasksMap: {
      'app-1': {
        target: tasks[0]
      },
      'app-2': {
        target: tasks[1]
      }
    }
  } as any;

  it('should pass the right options when options are passed', done => {
    runAll.mockImplementation(() => Promise.resolve());
    defaultTaskRunner(
      tasks,
      {
        parallel: true,
        maxParallel: 5
      },
      context
    ).subscribe({
      complete: () => {
        expect(runAll).toHaveBeenCalledWith(
          jasmine.any(Array),
          jasmine.objectContaining({
            parallel: true,
            maxParallel: 5
          })
        );
        done();
      }
    });
  });

  it('should run emit task complete events when "run-all-prerender" resolves', done => {
    runAll.mockImplementation(() => Promise.resolve());
    let i = 0;
    const expected = [
      {
        task: tasks[0],
        type: AffectedEventType.TaskComplete,
        success: true
      },
      {
        task: tasks[1],
        type: AffectedEventType.TaskComplete,
        success: true
      }
    ];
    defaultTaskRunner(tasks, {}, context).subscribe({
      next: event => {
        expect(event).toEqual(expected[i++]);
      },
      complete: done
    });
  });

  it('should run emit task complete events when "run-all-prerender" rejects', done => {
    runAll.mockImplementation(() =>
      Promise.reject({
        results: [
          {
            code: 0
          },
          {
            code: 1
          }
        ]
      })
    );
    let i = 0;
    const expected = [
      {
        task: tasks[0],
        type: AffectedEventType.TaskComplete,
        success: true
      },
      {
        task: tasks[1],
        type: AffectedEventType.TaskComplete,
        success: false
      }
    ];
    defaultTaskRunner(tasks, {}, context).subscribe({
      next: event => {
        expect(event).toEqual(expected[i++]);
      },
      complete: done
    });
  });
});
