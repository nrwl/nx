import { TasksRunner } from './tasks-runner';
import { getRunner } from './run-command';
import { NxJsonConfiguration } from '../config/nx-json';
import { join } from 'path';
import { nxCloudTasksRunnerShell } from '../nx-cloud/nx-cloud-tasks-runner-shell';

describe('getRunner', () => {
  let nxJson: NxJsonConfiguration;
  let mockRunner: TasksRunner;
  let overrides: any;

  beforeEach(() => {
    nxJson = {};
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

  it('uses default runner when no tasksRunnerOptions are present', () => {
    jest.mock(join(__dirname, './default-tasks-runner.ts'), () => mockRunner);

    const { tasksRunner } = getRunner({}, {});

    expect(tasksRunner).toEqual(mockRunner);
  });

  it('uses nx-cloud when no tasksRunnerOptions are present and accessToken is specified', () => {
    const { tasksRunner, runnerOptions } = getRunner(
      {},
      {
        nxCloudAccessToken: 'XXXX-XXX-XXXX',
        nxCloudUrl: 'https://my-nx-cloud.app',
      }
    );

    expect(tasksRunner).toEqual(nxCloudTasksRunnerShell);
    expect(runnerOptions).toMatchInlineSnapshot(`
      {
        "accessToken": "XXXX-XXX-XXXX",
        "url": "https://my-nx-cloud.app",
      }
    `);
  });

  it('reads options from base properties if no runner options provided', () => {
    jest.mock(join(__dirname, './default-tasks-runner.ts'), () => mockRunner);

    const { runnerOptions } = getRunner(
      {},
      {
        cacheDirectory: '.nx/cache',
        parallel: 3,
        useDaemonProcess: false,
        targetDefaults: {
          build: {
            cache: true,
          },
        },
      }
    );

    expect(runnerOptions).toMatchInlineSnapshot(`
      {
        "cacheDirectory": ".nx/cache",
        "cacheableOperations": [
          "build",
        ],
        "parallel": 3,
        "useDaemonProcess": false,
      }
    `);
  });
});
