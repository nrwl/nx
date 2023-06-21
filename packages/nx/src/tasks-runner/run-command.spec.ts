import { TasksRunner } from './tasks-runner';
import { getRunner } from './run-command';
import { NxJsonConfiguration } from '../config/nx-json';

describe('getRunner', () => {
  let nxJson: NxJsonConfiguration;
  let mockRunner: TasksRunner;
  let overrides: any;

  beforeEach(() => {
    nxJson = {
      npmScope: 'proj',
    };
    mockRunner = jest.fn();
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
      nxJson,
      true
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
      nxJson,
      true
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

    const { tasksRunner } = getRunner({}, nxJson, true);

    expect(tasksRunner).toEqual(mockRunner);
  });

  it('should set args via env', () => {
    jest.mock('custom-default-runner', () => mockRunner, {
      virtual: true,
    });

    nxJson.tasksRunnerOptions = {
      default: {
        runner: 'custom-default-runner',
      },
    };
    const args: Record<string, any> = {
      targets: ['test'],
      parallel: 3,
      skipNxCache: false,
      nxBail: false,
      nxIgnoreCycles: false,
      all: true,
      projects: [],
    };
    const previousEnv = structuredClone({ ...process.env });
    process.env.NX_BATCH_MODE = 'true';
    getRunner(args, nxJson, true);
    expect(process.env.NX_BATCH_MODE).toEqual('true');
    expect(args.outputStyle).toEqual('stream');
    process.env = previousEnv;
    expect(process.env.NX_BATCH_MODE).toBeUndefined();
  });
});
