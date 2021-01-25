import { TasksRunner } from './tasks-runner';
import defaultTaskRunner from './default-tasks-runner';
import { getRunner } from './run-command';
import { NxJson } from '../core/shared-interfaces';

describe('getRunner', () => {
  let nxJson: NxJson;
  let mockRunner: TasksRunner;
  let overrides: any;

  beforeEach(() => {
    nxJson = {
      npmScope: 'proj',
      projects: {},
    };
    mockRunner = jest.fn();
  });

  it('gets a default runner when runner is not defined in the nx json', () => {
    const { tasksRunner, runnerOptions } = getRunner({}, nxJson);

    expect(tasksRunner).toEqual(defaultTaskRunner);
  });

  it('gets a default runner when default options are not configured', () => {
    const { tasksRunner, runnerOptions } = getRunner({}, nxJson);

    expect(tasksRunner).toEqual(defaultTaskRunner);
  });

  it('gets a custom task runner', () => {
    jest.mock('custom-runner', () => mockRunner, {
      virtual: true,
    });

    nxJson.tasksRunnerOptions = {
      custom: {
        runner: 'custom-runner',
      },
    };

    const { tasksRunner, runnerOptions } = getRunner(
      { runner: 'custom' },
      nxJson
    );

    expect(tasksRunner).toEqual(mockRunner);
  });

  it('gets a custom task runner with options', () => {
    jest.mock('custom-runner2', () => mockRunner, {
      virtual: true,
    });

    nxJson.tasksRunnerOptions = {
      custom: {
        runner: 'custom-runner2',
        options: {
          runnerOption: 'runner-option',
        },
      },
    };

    const { tasksRunner, runnerOptions } = getRunner(
      { runner: 'custom' },
      nxJson
    );
    expect(tasksRunner).toBe(mockRunner);
    expect(runnerOptions).toEqual({
      runner: 'custom',
      runnerOption: 'runner-option',
    });
  });

  it('gets a custom defined default task runner', () => {
    jest.mock('custom-default-runner', () => mockRunner, {
      virtual: true,
    });

    nxJson.tasksRunnerOptions = {
      default: {
        runner: 'custom-default-runner',
      },
    };

    const { tasksRunner } = getRunner({}, nxJson);

    expect(tasksRunner).toEqual(mockRunner);
  });
});
