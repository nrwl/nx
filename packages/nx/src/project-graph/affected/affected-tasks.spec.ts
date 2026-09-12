import { describe, expect, it, vi } from 'vitest';

// getProjectGlobPatterns resolves these through getPlugins, which starts plugin
// workers. Mocked at that boundary rather than on affected-projects itself,
// since the call is module-internal and would not see a mock of its own export.
vi.mock('../plugins/get-plugins', () => ({
  getPlugins: async () => [{ createNodes: [] }],
}));
vi.mock('../utils/retrieve-workspace-files', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  getGlobPatternsOfPlugins: () => [
    '**/project.json',
    '**/package.json',
    '**/build.gradle',
  ],
}));
// Selection fetches the snapshot bundle before planning. The gate reads Nx
// Cloud config and env, which CI sets, so it is pinned off here rather than
// left to the environment.
vi.mock('../../io-snapshots/fetch', () => ({
  fetchIoSnapshotsForRun: async () => null,
  ioSnapshotOptionsFromNxJson: () => ({}),
}));

import { computeAffectedTasks } from './affected-tasks';
import { LockFileChange, WholeFileChange } from '../file-utils';
import type { ProjectGraph } from '../../config/project-graph';

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
      explain: true,
    });
    expect([...result.affectedTaskIds].sort()).toEqual([
      'hashes_all:test',
      'uses_moved:test',
    ]);
    expect(result.reasons['uses_moved:test']).toEqual([
      { kind: 'npm-package', package: 'npm:moved' },
    ]);
    expect(result.reasons['hashes_all:test']).toEqual([
      { kind: 'external-dependencies', file: 'package-lock.json' },
    ]);
  });

  it('selects nothing when the change reaches no input', async () => {
    expect(await affectedFor(['docs/README.md'])).toEqual([]);
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
      ).reasons;

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
