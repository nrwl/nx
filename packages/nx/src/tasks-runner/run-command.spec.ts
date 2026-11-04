import {
  getRunner,
  selectTasksForProjects,
  setEnvVarsBasedOnArgs,
} from './run-command';
import type { NxArgs } from '../utils/command-line-utils';
// getRunner loads the runner with a bare require, so compare against the
// instance from the same channel rather than the vite-imported copy.
const {
  nxCloudTasksRunnerShell,
} = require('../nx-cloud/nx-cloud-tasks-runner-shell');
import { withEnvironmentVariables } from '../internal-testing-utils/with-environment';

describe('getRunner', () => {
  it('uses default runner when no tasksRunnerOptions are present', () => {
    // getRunner loads the runner with a bare require, so fetch the expected
    // instance through the same channel rather than mocking the module.
    const expected = require('./default-tasks-runner').default;

    const { tasksRunner } = withEnvironmentVariables(
      {
        NX_CLOUD_ACCESS_TOKEN: undefined,
      },
      () => getRunner({}, {})
    );

    expect(tasksRunner).toEqual(expected);
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
        { specifiedOutputStyle: 'stream' }
      )
    ).toBe(true);
  });

  it('streams for stream-without-prefixes on GitHub Actions', () => {
    expect(
      resolveStreaming(
        { GITHUB_ACTIONS: 'true' },
        { specifiedOutputStyle: 'stream-without-prefixes' }
      )
    ).toBe(true);
  });

  it('streams when the TUI is active regardless of grouping', () => {
    expect(resolveStreaming({ GITHUB_ACTIONS: 'true', NX_TUI: 'true' })).toBe(
      true
    );
  });
});

describe('selectTasksForProjects', () => {
  const node = (name: string, targets: Record<string, any>) => ({
    name,
    type: 'lib' as const,
    data: { root: `libs/${name}`, targets },
  });
  const run = (dependsOn?: string[]) => ({
    executor: 'nx:run-commands',
    ...(dependsOn ? { dependsOn } : {}),
  });
  const projectGraph = {
    nodes: {
      app: node('app', { build: run(['^build']), test: run() }),
      lib: node('lib', { build: run(), test: run() }),
    },
    dependencies: {
      app: [{ source: 'app', target: 'lib', type: 'static' }],
      lib: [],
    },
  } as any;

  // The projects' own tasks initiate; what they pull in only runs for them.
  it("initiates the named projects' tasks of the targets, not their dependencies", () => {
    const selection = selectTasksForProjects(
      projectGraph,
      ['app'],
      { targets: ['build', 'test'] } as NxArgs,
      {},
      {},
      false
    );
    expect(Object.keys(selection.taskGraph.tasks).sort()).toEqual([
      'app:build',
      'app:test',
      'lib:build',
    ]);
    expect(selection.initiatingTaskIds.sort()).toEqual([
      'app:build',
      'app:test',
    ]);
    expect(selection.taskIds).toBeUndefined();
    expect(selection.tasksRunWithoutDependencies).toBeUndefined();
  });

  it('names a task whose dependency task was excluded', () => {
    const selection = selectTasksForProjects(
      projectGraph,
      ['app'],
      { targets: ['build'] } as NxArgs,
      {},
      {},
      true
    );

    expect(Object.keys(selection.taskGraph.tasks)).toEqual(['app:build']);
    expect(selection.tasksRunWithoutDependencies).toEqual(['app:build']);
  });

  it('names a task that depends on one run without its own dependency', () => {
    const withUtils = {
      nodes: {
        app: node('app', { build: run(['^build']) }),
        lib: node('lib', { build: run(['^build']) }),
        utils: node('utils', { build: run() }),
      },
      dependencies: {
        app: [{ source: 'app', target: 'lib', type: 'static' }],
        lib: [{ source: 'lib', target: 'utils', type: 'static' }],
        utils: [],
      },
    } as any;
    const selection = selectTasksForProjects(
      withUtils,
      ['app', 'lib'],
      { targets: ['build'] } as NxArgs,
      {},
      {},
      true
    );

    expect(Object.keys(selection.taskGraph.tasks).sort()).toEqual([
      'app:build',
      'lib:build',
    ]);
    expect(selection.tasksRunWithoutDependencies).toEqual([
      'app:build',
      'lib:build',
    ]);
  });

  it('leaves the list unset when every dependency task is selected', () => {
    const selection = selectTasksForProjects(
      projectGraph,
      ['app', 'lib'],
      { targets: ['build'] } as NxArgs,
      {},
      {},
      true
    );

    expect(Object.keys(selection.taskGraph.tasks).sort()).toEqual([
      'app:build',
      'lib:build',
    ]);
    expect(selection.tasksRunWithoutDependencies).toBeUndefined();
  });

  it('leaves the list unset for a task with no dependencies', () => {
    const selection = selectTasksForProjects(
      projectGraph,
      ['app'],
      { targets: ['test'] } as NxArgs,
      {},
      {},
      true
    );

    expect(Object.keys(selection.taskGraph.tasks)).toEqual(['app:test']);
    expect(selection.tasksRunWithoutDependencies).toBeUndefined();
  });

  it('does not name a task whose dependency is reached through a project without the target', () => {
    const graph = {
      nodes: {
        app: node('app', { build: run(['^build']) }),
        mid: node('mid', {}),
        lib: node('lib', { build: run() }),
      },
      dependencies: {
        app: [{ source: 'app', target: 'mid', type: 'static' }],
        mid: [{ source: 'mid', target: 'lib', type: 'static' }],
        lib: [],
      },
    } as any;
    const selection = selectTasksForProjects(
      graph,
      ['app', 'lib'],
      { targets: ['build'] } as NxArgs,
      {},
      {},
      true
    );

    expect(Object.keys(selection.taskGraph.tasks).sort()).toEqual([
      'app:build',
      'lib:build',
    ]);
    expect(selection.tasksRunWithoutDependencies).toBeUndefined();
  });
});
