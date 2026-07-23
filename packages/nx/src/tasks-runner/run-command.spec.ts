import { TasksRunner } from './tasks-runner';
import { getRunner, setEnvVarsBasedOnArgs } from './run-command';
import type { NxArgs } from '../utils/command-line-utils';
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

  it('uses cloud runner when tasksRunnerOptions are not present and authToken is set in env', () => {
    const { tasksRunner } = withEnvironmentVariables(
      {
        NX_CLOUD_AUTH_TOKEN: 'xxx-xx-xxx',
      },
      () => getRunner({}, {})
    );
    expect(tasksRunner).toEqual(nxCloudTasksRunnerShell);
  });

  it('does not use cloud runner when NX_NO_CLOUD=true, even if a cloud token is set in env', () => {
    const { tasksRunner } = withEnvironmentVariables(
      {
        NX_CLOUD_AUTH_TOKEN: 'xxx-xx-xxx',
        NX_NO_CLOUD: 'true',
      },
      () => getRunner({}, {})
    );
    expect(tasksRunner).not.toEqual(nxCloudTasksRunnerShell);
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
        "parallel": 3,
        "useDaemonProcess": false,
      }
    `);
  });
});

describe('setEnvVarsBasedOnArgs', () => {
  /**
   * Streamed output interleaves between tasks, so it cannot be wrapped in the
   * collapsible log groups that CI relies on. These cover which of the two wins.
   */
  function resolveStreaming(
    env: Record<string, string | undefined>,
    nxArgs: Partial<NxArgs> = {}
  ) {
    return withEnvironmentVariables(
      {
        GITHUB_ACTIONS: undefined,
        NX_BATCH_MODE: undefined,
        NX_PREFIX_OUTPUT: undefined,
        NX_SKIP_LOG_GROUPING: undefined,
        NX_STREAM_OUTPUT: undefined,
        NX_TUI: undefined,
        ...env,
      },
      () => {
        setEnvVarsBasedOnArgs(nxArgs as NxArgs, false);
        return process.env.NX_STREAM_OUTPUT === 'true';
      }
    );
  }

  it('streams in batch mode when log grouping does not apply', () => {
    expect(resolveStreaming({ NX_BATCH_MODE: 'true' })).toBe(true);
  });

  it('does not stream in batch mode on GitHub Actions, so output can be grouped', () => {
    expect(
      resolveStreaming({ NX_BATCH_MODE: 'true', GITHUB_ACTIONS: 'true' })
    ).toBe(false);
  });

  it('does not stream for --batch on GitHub Actions', () => {
    expect(resolveStreaming({ GITHUB_ACTIONS: 'true' }, { batch: true })).toBe(
      false
    );
  });

  it('streams in batch mode on GitHub Actions when grouping is skipped', () => {
    expect(
      resolveStreaming({
        NX_BATCH_MODE: 'true',
        GITHUB_ACTIONS: 'true',
        NX_SKIP_LOG_GROUPING: 'true',
      })
    ).toBe(true);
  });

  it('streams when the user explicitly asks for it, even on GitHub Actions', () => {
    expect(
      resolveStreaming(
        { NX_BATCH_MODE: 'true', GITHUB_ACTIONS: 'true' },
        { outputStyle: 'stream' }
      )
    ).toBe(true);
  });

  it('streams for stream-without-prefixes on GitHub Actions', () => {
    expect(
      resolveStreaming(
        { GITHUB_ACTIONS: 'true' },
        { outputStyle: 'stream-without-prefixes' }
      )
    ).toBe(true);
  });

  it('streams when the TUI is active regardless of grouping', () => {
    expect(resolveStreaming({ GITHUB_ACTIONS: 'true', NX_TUI: 'true' })).toBe(
      true
    );
  });
});
