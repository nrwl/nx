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

import { computeAffectedTasks } from './affected-tasks';
import { WholeFileChange } from '../file-utils';
import type { ProjectGraph } from '../../config/project-graph';

/**
 * `app` depends on `lib`. Both roots are real directories in this repo, because
 * the seeding distinguishes a config that changed from one that was deleted by
 * asking the filesystem.
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

  it('selects nothing when the change reaches no input', async () => {
    expect(await affectedFor(['docs/README.md'])).toEqual([]);
  });
});
