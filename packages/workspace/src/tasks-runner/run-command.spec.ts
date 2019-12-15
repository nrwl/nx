import { TasksRunner } from './tasks-runner';
import defaultTasksRunner from './default-tasks-runner';
import { getRunner } from './run-command';
import { NxJson } from '../core/shared-interfaces';

describe('getRunner', () => {
  let nxJson: NxJson;
  let mockRunner: TasksRunner;
  let targetArgs: any;

  beforeEach(() => {
    nxJson = {
      npmScope: 'proj',
      projects: {}
    };
    mockRunner = jest.fn();
    targetArgs = { foo: 'bar' };
  });

  it('gets a default runner when runner is not defined in the nx json', () => {
    const { tasksRunner, tasksOptions } = getRunner(
      undefined,
      nxJson,
      targetArgs
    );

    expect(tasksRunner).toEqual(defaultTasksRunner);
    expect(tasksOptions).toEqual(targetArgs);
  });

  it('gets a default runner when default options are not configured', () => {
    const { tasksRunner, tasksOptions } = getRunner(
      undefined,
      nxJson,
      targetArgs
    );

    expect(tasksRunner).toEqual(defaultTasksRunner);
    expect(tasksOptions).toEqual(targetArgs);
  });

  it('gets a custom task runner', () => {
    jest.mock('custom-runner', () => mockRunner, {
      virtual: true
    });

    nxJson.tasksRunnerOptions = {
      custom: {
        runner: 'custom-runner'
      }
    };

    const { tasksRunner, tasksOptions } = getRunner(
      'custom',
      nxJson,
      targetArgs
    );

    expect(tasksRunner).toEqual(mockRunner);
    expect(tasksOptions).toEqual(targetArgs);
  });

  it('gets a custom task runner with options', () => {
    jest.mock('custom-runner2', () => mockRunner, {
      virtual: true
    });

    nxJson.tasksRunnerOptions = {
      custom: {
        runner: 'custom-runner2',
        options: {
          runnerOption: 'runner-option'
        }
      }
    };

    const { tasksRunner, tasksOptions } = getRunner(
      'custom',
      nxJson,
      targetArgs
    );
    expect(tasksRunner).toBe(mockRunner);
    expect(tasksOptions).toEqual({
      runnerOption: 'runner-option',
      foo: 'bar'
    });
  });

  it('gets a custom defined default task runner', () => {
    jest.mock('custom-default-runner', () => mockRunner, {
      virtual: true
    });

    nxJson.tasksRunnerOptions = {
      default: {
        runner: 'custom-default-runner'
      }
    };

    const { tasksRunner } = getRunner(undefined, nxJson, targetArgs);

    expect(tasksRunner).toEqual(mockRunner);
  });
});
