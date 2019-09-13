import defaultTasksRunner from './default-tasks-runner';
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
  let tasks: Task[];
  beforeEach(() => {
    tasks = [
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
  });

  it('should run the correct commands through "npm-run-all"', done => {
    runAll.mockImplementation(() => Promise.resolve());
    defaultTasksRunner(tasks, {}).subscribe({
      complete: () => {
        expect(runAll).toHaveBeenCalledWith(
          ['nx run app-1:target', 'nx run app-2:target'],
          jasmine.anything()
        );
        done();
      }
    });
  });

  it('should run the correct commands through "npm-run-all" when tasks have a configuration', done => {
    runAll.mockImplementation(() => Promise.resolve());
    tasks = tasks.map(task => {
      task.target.configuration = 'production';
      return task;
    });
    defaultTasksRunner(tasks, {}).subscribe({
      complete: () => {
        expect(runAll).toHaveBeenCalledWith(
          ['nx run app-1:target:production', 'nx run app-2:target:production'],
          jasmine.anything()
        );
        done();
      }
    });
  });

  it('should run the correct commands through "npm-run-all" when tasks have overrides', done => {
    runAll.mockImplementation(() => Promise.resolve());
    tasks = tasks.map(task => {
      task.overrides = {
        override: 'override-value'
      };
      return task;
    });
    defaultTasksRunner(tasks, {}).subscribe({
      complete: () => {
        expect(runAll).toHaveBeenCalledWith(
          [
            'nx run app-1:target --override=override-value',
            'nx run app-2:target --override=override-value'
          ],
          jasmine.anything()
        );
        done();
      }
    });
  });

  it('should run the correct commands through "npm-run-all" when tasks have configurations and overrides', done => {
    runAll.mockImplementation(() => Promise.resolve());
    tasks = tasks.map(task => {
      task.target.configuration = 'production';
      task.overrides = {
        override: 'override-value'
      };
      return task;
    });
    defaultTasksRunner(tasks, {}).subscribe({
      complete: () => {
        expect(runAll).toHaveBeenCalledWith(
          [
            'nx run app-1:target:production --override=override-value',
            'nx run app-2:target:production --override=override-value'
          ],
          jasmine.anything()
        );
        done();
      }
    });
  });

  it('should pass the right options when options are passed', done => {
    runAll.mockImplementation(() => Promise.resolve());
    defaultTasksRunner(tasks, {
      parallel: true,
      maxParallel: 5
    }).subscribe({
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
    defaultTasksRunner(tasks, {}).subscribe({
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
    defaultTasksRunner(tasks, {}).subscribe({
      next: event => {
        expect(event).toEqual(expected[i++]);
      },
      complete: done
    });
  });
});
