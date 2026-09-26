import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import {
  DeletedFileChange,
  LockFileChange,
  WholeFileChange,
} from '../file-utils';
import { ProjectGraphError } from '../error-types';
import type { ProjectGraph } from '../../config/project-graph';
import { createTaskGraph } from '../../tasks-runner/create-task-graph';
import { pruneToSelectedTasks } from '../../tasks-runner/utils';
import { connectToNxDb, IoSnapshotStore } from '../../native';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

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

  it('explains a task reached through a changed project config', async () => {
    const { explanation } = await computeAffectedTasks({
      projectGraph: graph(),
      nxJson: {
        namedInputs: { production: ['{projectRoot}/src/**/*'] },
      } as any,
      targets: ['test'],
      touchedFiles: [
        {
          file: 'packages/nx/package.json',
          getChanges: () => [new WholeFileChange()],
        },
      ] as any,
      explain: true,
    });
    for (const task of ['lib:test', 'app:test']) {
      expect(explanation.affected[task]).toContainEqual({
        kind: 'project-configuration',
        file: 'packages/nx/package.json',
      });
    }
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

  it('explains a deleted project config where nothing narrower applies', async () => {
    const { explanation } = await computeAffectedTasks({
      projectGraph: graph(),
      nxJson: {
        namedInputs: { production: ['{projectRoot}/src/**/*'] },
      } as any,
      targets: ['test'],
      touchedFiles: [
        {
          file: 'packages/nx/does-not-exist/project.json',
          getChanges: () => [new DeletedFileChange()],
        },
      ] as any,
      explain: true,
    });
    expect(explanation.affected['lib:test']).toEqual([
      {
        kind: 'deleted-project-configuration',
        file: 'packages/nx/does-not-exist/project.json',
      },
    ]);
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
      explain: true,
    });
    expect([...result.affectedTaskIds].sort()).toEqual([
      'hashes_all:test',
      'uses_moved:test',
    ]);
    expect(result.explanation.affected['uses_moved:test']).toEqual([
      { kind: 'npm-package', package: 'npm:moved' },
    ]);
    expect(result.explanation.affected['hashes_all:test']).toEqual([
      { kind: 'external-dependencies', file: 'package-lock.json' },
    ]);
  });

  // The project is named by config, not by an input, so the reason says so.
  it('explains a project projectsAffectedByDependencyUpdates names', async () => {
    const { explanation } = await computeAffectedTasks({
      projectGraph: graph(),
      nxJson: {
        namedInputs: { production: ['{projectRoot}/src/**/*'] },
        pluginsConfig: {
          '@nx/js': { projectsAffectedByDependencyUpdates: ['lib'] },
        },
      } as any,
      targets: ['test'],
      touchedFiles: [
        {
          file: 'pnpm-lock.yaml',
          getChanges: () => [new WholeFileChange()],
        },
      ] as any,
      explain: true,
    });
    expect(explanation.affected['lib:test']).toContainEqual({
      kind: 'lockfile',
      file: 'pnpm-lock.yaml',
    });
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

  /**
   * Every reason that applies: the input a changed file matched, the affected
   * producer whose outputs a task reads, and the package a dependency change
   * moved, or the file that moved it for a plan hashing every external.
   */
  it('explains each task with what reached it', async () => {
    const explain = async (files: string[]) =>
      (
        await computeAffectedTasks({
          projectGraph: graph(),
          nxJson: {
            namedInputs: { production: ['{projectRoot}/src/**/*'] },
          } as any,
          targets: ['test'],
          touchedFiles: files.map((file) => ({
            file,
            getChanges: () => [new WholeFileChange()],
          })) as any,
          explain: true,
        })
      ).explanation.affected;

    const byFile = await explain(['packages/nx/src/index.ts']);
    expect(byFile['lib:test']).toContainEqual(
      expect.objectContaining({
        kind: 'input-file',
        file: 'packages/nx/src/index.ts',
      })
    );
    // app:test inlines lib's production fileset through ^production, so the
    // same file reaches it as an input rather than through a producer.
    expect(byFile['app:test']).toContainEqual(
      expect.objectContaining({
        kind: 'input-file',
        file: 'packages/nx/src/index.ts',
      })
    );

    // Neither target declares externalDependencies, so each plan hashes every
    // external and the lockfile reaches both directly: no seed, no dependency
    // edge to report.
    const byLockfile = await explain(['pnpm-lock.yaml']);
    for (const task of ['lib:test', 'app:test']) {
      expect(byLockfile[task]).toEqual([
        { kind: 'external-dependencies', file: 'pnpm-lock.yaml' },
      ]);
    }
  });
});

describe('explaining a change carried by a dependency-only task', () => {
  // Under -t build, prebuild is only a dependency, so it is not selected. It
  // is still what the change reached, and the build's reason names it.
  it('lists the producer a reason names, outside the selection', async () => {
    const result = await computeAffectedTasks({
      projectGraph: {
        nodes: {
          app: {
            name: 'app',
            type: 'app',
            data: {
              root: 'packages/js',
              targets: {
                prebuild: {
                  executor: 'nx:run-commands',
                  inputs: ['{projectRoot}/src/**/*'],
                  outputs: ['{workspaceRoot}/dist/gen'],
                },
                build: {
                  executor: 'nx:run-commands',
                  dependsOn: ['prebuild'],
                  inputs: [{ dependentTasksOutputFiles: '**/*' }],
                },
              },
            },
          },
        },
        dependencies: { app: [] },
        externalNodes: {},
      } as any,
      nxJson: {} as any,
      targets: ['build'],
      touchedFiles: [
        {
          file: 'packages/js/src/index.ts',
          getChanges: () => [new WholeFileChange()],
        },
      ] as any,
      explain: true,
    });

    expect(Object.keys(result.explanation.affected)).toEqual(['app:build']);
    expect(result.explanation.affected['app:build']).toEqual([
      { kind: 'dependent-output', producer: 'app:prebuild' },
    ]);
    // Selection's own touched set: the prebuild matched, the build did not.
    expect(result.explanation.touched).toEqual(['app:prebuild']);
    expect(result.explanation.upstream['app:prebuild']).toContainEqual(
      expect.objectContaining({
        kind: 'input-file',
        file: 'packages/js/src/index.ts',
      })
    );
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

describe('explaining what a run needs first', () => {
  // prebuild's own input changed, but build only orders after it rather than
  // reading its outputs: it runs as a dependency the change still touched.
  it('lists a touched dependency as touched, not as untouched', async () => {
    const { explanation } = await computeAffectedTasks({
      projectGraph: {
        nodes: {
          app: {
            name: 'app',
            type: 'app',
            data: {
              root: 'packages/js',
              targets: {
                prebuild: {
                  executor: 'nx:run-commands',
                  inputs: ['{projectRoot}/bin/**/*'],
                },
                build: {
                  executor: 'nx:run-commands',
                  dependsOn: ['prebuild'],
                  inputs: ['{projectRoot}/src/**/*'],
                },
              },
            },
          },
        },
        dependencies: { app: [] },
        externalNodes: {},
      } as any,
      nxJson: {} as any,
      targets: ['build'],
      touchedFiles: ['packages/js/src/index.ts', 'packages/js/bin/nx.ts'].map(
        (file) => ({ file, getChanges: () => [new WholeFileChange()] })
      ) as any,
      explain: true,
    });
    expect(explanation.required).toEqual({});
    expect(explanation.upstream['app:prebuild']).toContainEqual(
      expect.objectContaining({
        kind: 'input-file',
        file: 'packages/js/bin/nx.ts',
      })
    );
    expect(explanation.touched).toContain('app:prebuild');
  });

  // A lib change cannot reach app:test, so lib:test runs only because the
  // affected app:test depends on it.
  it('lists a kept task the change never reached, with what needs it', async () => {
    const { explanation } = await computeAffectedTasks({
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
      explain: true,
    });
    expect(Object.keys(explanation.affected)).toEqual(['app:test']);
    expect(explanation.required).toEqual({ 'lib:test': ['app:test'] });
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

describe('selection with an I/O snapshot set', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'affected-io-snapshots-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  // The run hashes lib:test from what it read, so a change to a file it read
  // but never declared has to select it.
  it('selects a task through a file it read but did not declare', async () => {
    const commit = 'head'.padEnd(40, '0');
    const db = connectToNxDb(dir, 'io-snapshots');
    new IoSnapshotStore(db).import({
      requestedCommit: commit,
      snapshotsJson: JSON.stringify({
        'lib:test': { commit, inputs: ['docs/README.md'], outputs: [] },
      }),
    });
    const snapshots = new IoSnapshotStore(db).get(commit);
    const select = (ioSnapshotOutcome?: any) =>
      computeAffectedTasks({
        projectGraph: graph(),
        nxJson: {
          namedInputs: { production: ['{projectRoot}/src/**/*'] },
        } as any,
        targets: ['test'],
        touchedFiles: [
          { file: 'docs/README.md', getChanges: () => [new WholeFileChange()] },
        ] as any,
        ioSnapshotOutcome,
      });

    expect([...(await select()).affectedTaskIds]).toEqual([]);
    const outcome = { status: 'fetched', snapshots };
    const withSnapshots = await select(outcome);
    expect([...withSnapshots.affectedTaskIds]).toEqual(['lib:test']);
    // The run hashes with the same set rather than loading its own.
    expect(withSnapshots.taskSelection.ioSnapshotOutcome).toBe(outcome);
  });
});

describe('tasks with a custom hasher', () => {
  afterEach(() => customHashers.clear());

  // It hashes outside its plan, so no instruction says what reaches it.
  it('are always selected', async () => {
    customHashers.add('lib');
    expect(await affectedFor(['docs/README.md'])).toEqual(['lib:test']);
  });

  it('say why they were selected', async () => {
    customHashers.add('lib');
    const { explanation } = await computeAffectedTasks({
      projectGraph: graph(),
      nxJson: {
        namedInputs: { production: ['{projectRoot}/src/**/*'] },
      } as any,
      targets: ['test'],
      touchedFiles: [
        { file: 'docs/README.md', getChanges: () => [new WholeFileChange()] },
      ] as any,
      explain: true,
    });
    expect(explanation.affected).toEqual({
      'lib:test': [{ kind: 'custom-hasher' }],
    });
  });
});

describe('computeAffectedTasks with the daemon on', () => {
  beforeEach(() => vi.clearAllMocks());

  // The daemon resolves the same stored version, so it selects as the run hashes.
  it('sends the snapshot version and keeps the loaded set for the run', async () => {
    daemon.enabled.mockReturnValueOnce(true);
    const empty = {
      roots: [],
      tasks: {},
      dependencies: {},
      continuousDependencies: {},
    };
    daemon.selectAffectedTasks.mockResolvedValueOnce({
      projectGraph: graph(),
      affectedTaskIds: [],
      taskGraph: empty,
      taskSelection: { taskGraph: empty, initiatingTaskIds: [], taskIds: [] },
    });
    const outcome = {
      status: 'cached',
      snapshots: { commit: 'abc', resolution: { fetchedAt: 7 } },
    } as any;

    const result = await computeAffectedTasks({
      nxJson: {} as any,
      targets: ['test'],
      touchedFiles: [],
      ioSnapshotOutcome: outcome,
    });

    const [request] = daemon.selectAffectedTasks.mock.calls[0];
    expect(request.ioSnapshots).toEqual({ commit: 'abc', fetchedAt: 7 });
    expect(JSON.parse(JSON.stringify(request))).toEqual(request);
    expect(result.taskSelection.ioSnapshotOutcome).toBe(outcome);
  });

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

  // Reasons are assembled from native plans, which stay in whichever process
  // planned them, and an explanation runs nothing to share them with.
  it('explains in-process rather than asking the daemon', async () => {
    daemon.enabled.mockReturnValueOnce(true);

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
      explain: true,
    });

    expect(daemon.selectAffectedTasks).not.toHaveBeenCalled();
    expect(result.explanation.affected['lib:test']).toContainEqual(
      expect.objectContaining({
        kind: 'input-file',
        file: 'packages/nx/src/x.ts',
      })
    );
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
