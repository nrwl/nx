import { TasksRunner } from './tasks-runner';
import { getRunner } from './run-command';
import { NxJsonConfiguration } from '../config/nx-json';
import { join } from 'path';
import { nxCloudTasksRunnerShell } from '../nx-cloud/nx-cloud-tasks-runner-shell';
import { withEnvironmentVariables } from '../internal-testing-utils/with-environment';

describe('getRunner', () => {
  let nxJson: NxJsonConfiguration;
  let mockRunner: TasksRunner;
  let overrides: any;

  beforeEach(() => {
    nxJson = {};
    mockRunner = jest.fn();
  });

  it('uses default runner when no tasksRunnerOptions are present', () => {
    jest.mock(join(__dirname, './default-tasks-runner.ts'), () => mockRunner);

    const { tasksRunner } = withEnvironmentVariables(
      {
        NX_CLOUD_ACCESS_TOKEN: undefined,
      },
      () => getRunner({}, {})
    );

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

  it('uses cloud runner when tasksRunnerOptions are not present and nxCloudId is specified', () => {
    const { tasksRunner, runnerOptions } = getRunner(
      {},
      {
        nxCloudId: 'XXXX-XXX',
        nxCloudUrl: 'https://my-nx-cloud.app',
      }
    );

    expect(tasksRunner).toEqual(nxCloudTasksRunnerShell);
    expect(runnerOptions).toMatchInlineSnapshot(`
      {
        "nxCloudId": "XXXX-XXX",
        "url": "https://my-nx-cloud.app",
      }
    `);
  });

  it('uses cloud runner when tasksRunnerOptions are not present and accessToken is set in env', () => {
    const { tasksRunner } = withEnvironmentVariables(
      {
        NX_CLOUD_ACCESS_TOKEN: 'xxx-xx-xxx',
      },
      () => getRunner({}, {})
    );
    expect(tasksRunner).toEqual(nxCloudTasksRunnerShell);
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
