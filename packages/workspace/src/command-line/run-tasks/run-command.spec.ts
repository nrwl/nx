import { NxJson } from '../shared';
import { TasksRunner } from '../../tasks-runner/tasks-runner';
import defaultTasksRunner from '../../tasks-runner/default-tasks-runner';
import { getRunner } from './run-command';

describe('getRunner', () => {
  let nxJson: NxJson;
  let mockRunner: TasksRunner;
  let targetArgs: any;
  let runner: string | undefined;

  beforeEach(() => {
    nxJson = {
      npmScope: 'proj',
      projects: {}
    };
    runner = undefined;
    mockRunner = jest.fn();
    targetArgs = { foo: 'bar' };
  });

  it('gets a default runner when runner is not defined in the nx json', () => {
    const { tasksRunner, tasksOptions } = getRunner(runner, nxJson, targetArgs);

    expect(tasksRunner).toEqual(defaultTasksRunner);
    expect(tasksOptions).toEqual(targetArgs);
  });

  it('gets a default runner when default options are not configured', () => {
    const { tasksRunner, tasksOptions } = getRunner(runner, nxJson, targetArgs);

    expect(tasksRunner).toEqual(defaultTasksRunner);
    expect(tasksOptions).toEqual(targetArgs);
  });

  it('gets a custom task runner', () => {
    jest.mock('custom-runner', () => mockRunner, {
      virtual: true
    });

    runner = 'custom';

    nxJson.tasksRunnerOptions = {
      custom: {
        runner: 'custom-runner'
      }
    };

    const { tasksRunner, tasksOptions } = getRunner(runner, nxJson, targetArgs);

    expect(tasksRunner).toEqual(mockRunner);
    expect(tasksOptions).toEqual(targetArgs);
  });

  it.only('gets a custom task runner with options', () => {
    jest.mock('custom-runner', () => mockRunner, {
      virtual: true
    });

    nxJson.tasksRunnerOptions = {
      custom: {
        runner: 'custom-runner',
        options: {
          runnerOption: 'runner-option'
        }
      }
    };

    runner = 'custom';

    const { tasksRunner, tasksOptions } = getRunner(runner, nxJson, targetArgs);

    expect(tasksRunner).toEqual(mockRunner);
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

    const { tasksRunner } = getRunner(runner, nxJson, targetArgs);

    expect(tasksRunner).toEqual(mockRunner);
  });
});
