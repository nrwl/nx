import { afterEach, describe, expect, it, vi } from 'vitest';

// getProjectGlobPatterns reads these from the plugins' recorded capabilities.
vi.mock('../plugins/get-plugins', () => ({
  capabilitiesOfConfiguredPlugins: async () =>
    ['**/project.json', '**/package.json', '**/build.gradle'].map(
      (createNodesPattern) => ({ createNodesPattern })
    ),
}));
// Off unless a test turns it on, so selection runs in-process whatever
// NX_DAEMON the suite happens to run under.
const daemon = vi.hoisted(() => ({
  enabled: vi.fn(() => false),
  selectAffectedTasks: vi.fn(),
}));
vi.mock('../../daemon/client/client', () => ({ daemonClient: daemon }));
const onDaemon = vi.hoisted(() => ({ isOnDaemon: vi.fn(() => false) }));
vi.mock('../../daemon/is-on-daemon', () => onDaemon);
// Real executor lookups, except for projects a test gives a custom hasher.
const customHashers = vi.hoisted(() => new Set<string>());
vi.mock('../../tasks-runner/utils', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getExecutorForTask: (task, projects) =>
      customHashers.has(task.target.project)
        ? { hasherFactory: () => ({}) }
        : actual.getExecutorForTask(task, projects),
  };
});
import { computeAffectedTasks, selectsAffectedTasks } from './affected-tasks';
import { LockFileChange, WholeFileChange } from '../file-utils';
import { ProjectGraphError } from '../error-types';
import type { ProjectGraph } from '../../config/project-graph';
import { createTaskGraph } from '../../tasks-runner/create-task-graph';
import { pruneToSelectedTasks } from '../../tasks-runner/utils';

/**
 * `app` depends on `lib`. Both roots are real directories in this repo, because
 * the selection distinguishes a config that changed from one that was deleted
 * by asking the filesystem.
 */
function graph(): ProjectGraph {
  return {
    nodes: {
      lib: {
        name: 'lib',
        type: 'lib',
        data: {
          root: 'packages/nx',
          targets: {
            test: {
              executor: 'nx:run-commands',
              inputs: ['{projectRoot}/src/**/*'],
            },
          },
        },
      },
      app: {
        name: 'app',
        type: 'app',
        data: {
          root: 'packages/js',
          targets: {
            test: {
              executor: 'nx:run-commands',
              // Narrow on purpose. A stock `default` glob-matches project.json
              // and would mask whether the config reaches the consumer.
              inputs: ['{projectRoot}/src/**/*', '^production'],
            },
          },
        },
      },
    },
    dependencies: {
      app: [{ source: 'app', target: 'lib', type: 'static' }],
      lib: [],
    },
    externalNodes: {},
  } as any;
}

async function affectedFor(files: string[]): Promise<string[]> {
  const result = await computeAffectedTasks({
    projectGraph: graph(),
    nxJson: { namedInputs: { production: ['{projectRoot}/src/**/*'] } } as any,
    targets: ['test'],
    touchedFiles: files.map((file) => ({
      file,
      getChanges: () => [new WholeFileChange()],
    })) as any,
  });
  return [...result.affectedTaskIds].sort();
}

describe('computeAffectedTasks', () => {
  it('selects a task whose own files changed, and its dependents', async () => {
    expect(await affectedFor(['packages/nx/src/index.ts'])).toEqual([
      'app:test',
      'lib:test',
    ]);
  });

  /**
   * ProjectConfiguration is spliced into a consumer's plan for each dependency
   * and is real hash entropy, but it resolves to no files, so nothing in the
   * consumer's filesets can match the config file. Seeding only the owning
   * project would leave the consumer running against a stale hash.
   */
  it("selects dependents when a dependency's project config changes", async () => {
    expect(await affectedFor(['packages/nx/package.json'])).toContain(
      'app:test'
    );
  });

  /**
   * The project the config described is gone from the graph, so no surviving
   * task has a fileset that names it and nothing narrower than everything is
   * sound. Matches `projects_from_project_glob_changes`.
   */
  it('widens to everything when a project config was deleted', async () => {
    const affected = await affectedFor([
      'packages/nx/does-not-exist/project.json',
    ]);
    expect(affected).toEqual(['app:test', 'lib:test']);
  });

  /**
   * The deletion check uses the plugin globs rather than two hardcoded
   * basenames, so a gradle or dotnet workspace is covered the same way.
   */
  it('treats a deleted plugin-owned config the same as a project.json', async () => {
    const affected = await affectedFor(['packages/nx/gone/build.gradle']);
    expect(affected).toEqual(['app:test', 'lib:test']);
  });

  /**
   * Neither target declares externalDependencies, so each plan hashes every
   * external node, and the default `projectsAffectedByDependencyUpdates` of
   * "all" counts every one as moved.
   */
  it('selects every task hashing all externals when the lockfile changes', async () => {
    expect(await affectedFor(['pnpm-lock.yaml'])).toEqual([
      'app:test',
      'lib:test',
    ]);
  });

  /**
   * The package a lockfile change moved is matched against the External
   * instructions in each plan, the way a changed path is matched against
   * filesets, so a task only reaches the answer through a package it hashes.
   */
  it('matches a moved package against the externals each task hashes', async () => {
    const lockFile = (version: string, extra: Record<string, any> = {}) =>
      JSON.stringify({
        name: 'test',
        version: '1.0.0',
        lockfileVersion: 3,
        requires: true,
        packages: {
          '': {
            name: 'test',
            version: '1.0.0',
            dependencies: { moved: `^${version}`, steady: '^1.0.0' },
          },
          'node_modules/moved': {
            version,
            resolved: `https://registry.npmjs.org/moved/-/moved-${version}.tgz`,
            integrity: `sha512-${version}`,
          },
          'node_modules/steady': {
            version: '1.0.0',
            resolved: 'https://registry.npmjs.org/steady/-/steady-1.0.0.tgz',
            integrity: 'sha512-steady',
          },
          ...extra,
        },
      });
    const external = (name: string, version: string) => ({
      type: 'npm' as const,
      name: `npm:${name}`,
      data: { packageName: name, version, hash: `sha512-${version}` },
    });
    const target = (inputs: any[]) => ({
      test: { executor: 'nx:run-commands', inputs },
    });
    const projectGraph = {
      nodes: {
        uses_moved: {
          name: 'uses_moved',
          type: 'lib',
          data: {
            root: 'packages/nx',
            targets: target([{ externalDependencies: ['moved'] }]),
          },
        },
        uses_steady: {
          name: 'uses_steady',
          type: 'lib',
          data: {
            root: 'packages/js',
            targets: target([{ externalDependencies: ['steady'] }]),
          },
        },
        hashes_all: {
          name: 'hashes_all',
          type: 'lib',
          data: {
            root: 'packages/devkit',
            targets: target(['{projectRoot}/**/*']),
          },
        },
        hashes_none: {
          name: 'hashes_none',
          type: 'lib',
          data: {
            root: 'packages/workspace',
            targets: target([{ externalDependencies: [] }]),
          },
        },
      },
      dependencies: {
        uses_moved: [],
        uses_steady: [],
        hashes_all: [],
        hashes_none: [],
      },
      externalNodes: {
        'npm:moved': external('moved', '2.0.0'),
        'npm:steady': external('steady', '1.0.0'),
      },
    } as any;

    const result = await computeAffectedTasks({
      projectGraph,
      nxJson: {
        pluginsConfig: {
          '@nx/js': { projectsAffectedByDependencyUpdates: 'auto' },
        },
      } as any,
      targets: ['test'],
      touchedFiles: [
        {
          file: 'package-lock.json',
          getChanges: () => [
            new LockFileChange(lockFile('1.0.0'), lockFile('2.0.0')),
          ],
        },
      ] as any,
    });
    expect([...result.affectedTaskIds].sort()).toEqual([
      'hashes_all:test',
      'uses_moved:test',
    ]);
  });

  it('selects nothing when the change reaches no input', async () => {
    expect(await affectedFor(['docs/README.md'])).toEqual([]);
  });

  it('drops an excluded project from both the selection and what a run keeps', async () => {
    const result = await computeAffectedTasks({
      projectGraph: graph(),
      nxJson: {
        namedInputs: { production: ['{projectRoot}/src/**/*'] },
      } as any,
      targets: ['test'],
      touchedFiles: [
        {
          file: 'packages/nx/src/index.ts',
          getChanges: () => [new WholeFileChange()],
        },
      ] as any,
      exclude: ['lib'],
    });
    expect([...result.affectedTaskIds]).toEqual(['app:test']);
    expect(result.taskSelection.taskIds).toEqual(['app:test']);
  });
});

describe('the run graph selection hands over', () => {
  // app:test depends on lib:test, which only a lib change affects. The run
  // builds from app alone, so lib:test is a dependency there and must not
  // carry the CLI overrides it took as an initial task of the full graph.
  it('is what building from the owning projects and pruning would give', async () => {
    const overrides = {
      watch: false,
      __overrides_unparsed__: ['--watch=false'],
    };
    const extraTargetDependencies = { test: ['^test'] };
    const result = await computeAffectedTasks({
      projectGraph: graph(),
      nxJson: {
        namedInputs: { production: ['{projectRoot}/src/**/*'] },
      } as any,
      targets: ['test'],
      touchedFiles: [
        {
          file: 'packages/js/src/index.ts',
          getChanges: () => [new WholeFileChange()],
        },
      ] as any,
      overrides,
      extraTargetDependencies,
    });
    expect([...result.affectedTaskIds]).toEqual(['app:test']);

    const expected = pruneToSelectedTasks(
      createTaskGraph(
        graph(),
        extraTargetDependencies,
        ['app'],
        ['test'],
        undefined,
        overrides
      ),
      result.taskSelection.taskIds
    );
    expect(result.taskSelection.taskGraph.tasks).toEqual(expected.tasks);
    expect(result.taskSelection.taskGraph.tasks['lib:test'].overrides).toEqual({
      __overrides_unparsed__: [],
    });
    expect(result.taskSelection.taskGraph.dependencies).toEqual(
      expected.dependencies
    );
    // lib:test runs only because app:test needs it.
    expect(result.taskSelection.initiatingTaskIds).toEqual(['app:test']);
  });
});

describe('the run graph with --exclude-task-dependencies', () => {
  // The run builds app:test alone, so lib:test must not ride along even
  // though the full graph keeps the edge between two initial tasks.
  it('holds only the selected tasks', async () => {
    const result = await computeAffectedTasks({
      projectGraph: graph(),
      nxJson: {
        namedInputs: { production: ['{projectRoot}/src/**/*'] },
      } as any,
      targets: ['test'],
      touchedFiles: [
        {
          file: 'packages/js/src/index.ts',
          getChanges: () => [new WholeFileChange()],
        },
      ] as any,
      extraTargetDependencies: { test: ['^test'] },
      excludeTaskDependencies: true,
    });
    expect(Object.keys(result.taskSelection.taskGraph.tasks)).toEqual([
      'app:test',
    ]);
  });

  // The flag drops what runs, not what carries a change: lib:build is only a
  // dependency, yet a lib change still reaches app:test through its output.
  it('still selects a consumer through a dependency it does not run', async () => {
    const projectGraph = graph();
    projectGraph.nodes.lib.data.targets = {
      build: {
        executor: 'nx:run-commands',
        inputs: ['{projectRoot}/src/**/*'],
        outputs: ['{workspaceRoot}/dist/lib'],
      },
    };
    projectGraph.nodes.app.data.targets.test = {
      executor: 'nx:run-commands',
      dependsOn: ['^build'],
      inputs: [
        '{projectRoot}/src/**/*',
        { fileset: '{workspaceRoot}/dist/lib/**', includeIgnored: true },
      ],
    } as any;
    const result = await computeAffectedTasks({
      projectGraph,
      nxJson: {} as any,
      targets: ['test'],
      touchedFiles: [
        {
          file: 'packages/nx/src/index.ts',
          getChanges: () => [new WholeFileChange()],
        },
      ] as any,
      excludeTaskDependencies: true,
    });
    expect([...result.affectedTaskIds]).toEqual(['app:test']);
    expect(Object.keys(result.taskSelection.taskGraph.tasks)).toEqual([
      'app:test',
    ]);
  });
});

describe('tasks with a custom hasher', () => {
  afterEach(() => customHashers.clear());

  // It hashes outside its plan, so no instruction says what reaches it.
  it('are always selected', async () => {
    customHashers.add('lib');
    expect(await affectedFor(['docs/README.md'])).toEqual(['lib:test']);
  });
});

describe('computeAffectedTasks with the daemon on', () => {
  beforeEach(() => vi.clearAllMocks());

  it('asks the daemon to select, sending the request as plain data', async () => {
    daemon.enabled.mockReturnValueOnce(true);
    const daemonGraph = graph();
    daemon.selectAffectedTasks.mockResolvedValueOnce({
      projectGraph: daemonGraph,
      affectedTaskIds: ['lib:test'],
      taskGraph: {
        roots: [],
        tasks: {},
        dependencies: {},
        continuousDependencies: {},
      },
      taskSelection: {
        taskGraph: {
          roots: [],
          tasks: {},
          dependencies: {},
          continuousDependencies: {},
        },
        initiatingTaskIds: ['lib:test'],
        taskIds: ['lib:test'],
      },
    });

    const result = await computeAffectedTasks({
      projectGraph: graph(),
      nxJson: {} as any,
      targets: ['test'],
      touchedFiles: [
        {
          file: 'packages/nx/src/x.ts',
          getChanges: () => [new WholeFileChange()],
        },
      ] as any,
    });

    const [request] = daemon.selectAffectedTasks.mock.calls[0];
    expect(request).toMatchObject({
      targets: ['test'],
      changedFiles: ['packages/nx/src/x.ts'],
      overrides: {},
      extraTargetDependencies: {},
      excludeTaskDependencies: false,
      exclude: [],
    });
    // A FileChange's lazy getChanges() cannot cross the socket.
    expect(JSON.parse(JSON.stringify(request))).toEqual(request);
    expect([...result.affectedTaskIds]).toEqual(['lib:test']);
    expect(result.taskSelection.taskIds).toEqual(['lib:test']);
    expect(result.taskSelection.initiatingTaskIds).toEqual(['lib:test']);
    // The planner stays in the daemon, which is what hashes.
    expect(result.taskSelection.planningContext).toBeUndefined();
    // The command runs with the graph the daemon selected against.
    expect(result.projectGraph).toBe(daemonGraph);
  });

  // The daemon already found the graph broken; fetching it again would only
  // ask the same daemon the same question.
  it('reports a broken graph the daemon found without selecting again', async () => {
    daemon.enabled.mockReturnValueOnce(true);
    daemon.selectAffectedTasks.mockRejectedValueOnce(
      Object.assign(new Error('graph'), {
        name: 'DaemonProjectGraphError',
        errors: [],
        projectGraph: graph(),
        sourceMaps: {},
      })
    );

    await expect(
      computeAffectedTasks({
        projectGraph: graph(),
        nxJson: {} as any,
        targets: ['test'],
        touchedFiles: [],
      })
    ).rejects.toBeInstanceOf(ProjectGraphError);
  });

  it('selects in-process when the daemon cannot', async () => {
    daemon.enabled.mockReturnValueOnce(true);
    daemon.selectAffectedTasks.mockRejectedValueOnce(
      new Error('socket closed')
    );
    const projectGraph = graph();

    const result = await computeAffectedTasks({
      projectGraph,
      nxJson: {
        namedInputs: { production: ['{projectRoot}/src/**/*'] },
      } as any,
      targets: ['test'],
      touchedFiles: [
        {
          file: 'packages/nx/src/x.ts',
          getChanges: () => [new WholeFileChange()],
        },
      ] as any,
    });

    expect(result.projectGraph).toBe(projectGraph);
    expect([...result.affectedTaskIds].sort()).toEqual([
      'app:test',
      'lib:test',
    ]);
    expect(result.taskSelection.planningContext).toBeDefined();
  });

  // Inside the daemon there is no daemon to ask.
  it('selects in-process when already running inside the daemon', async () => {
    daemon.enabled.mockReturnValueOnce(true);
    onDaemon.isOnDaemon.mockReturnValueOnce(true);

    const result = await computeAffectedTasks({
      projectGraph: graph(),
      nxJson: {
        namedInputs: { production: ['{projectRoot}/src/**/*'] },
      } as any,
      targets: ['test'],
      touchedFiles: [
        {
          file: 'packages/nx/src/x.ts',
          getChanges: () => [new WholeFileChange()],
        },
      ] as any,
    });

    expect(daemon.selectAffectedTasks).not.toHaveBeenCalled();
    expect(result.taskSelection.planningContext).toBeDefined();
  });
});

describe('selectsAffectedTasks', () => {
  const original = process.env.NX_LEGACY_AFFECTED;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NX_LEGACY_AFFECTED;
    } else {
      process.env.NX_LEGACY_AFFECTED = original;
    }
  });

  // Task selection stays opt-in; flipping the default must be a deliberate edit that fails here.
  it('selects whole projects when the variable is unset', () => {
    delete process.env.NX_LEGACY_AFFECTED;
    expect(selectsAffectedTasks()).toBe(false);
  });

  it('selects whole projects when the variable is true', () => {
    process.env.NX_LEGACY_AFFECTED = 'true';
    expect(selectsAffectedTasks()).toBe(false);
  });

  it('selects tasks only when the variable is false', () => {
    process.env.NX_LEGACY_AFFECTED = 'false';
    expect(selectsAffectedTasks()).toBe(true);
  });
});
