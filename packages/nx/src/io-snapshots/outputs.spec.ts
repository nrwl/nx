import { join } from 'path';
import { TempFs } from '../internal-testing-utils/temp-fs';
import type { ProjectGraph } from '../config/project-graph';
import type { TaskGraph } from '../config/task-graph';
import {
  closeDbConnection,
  connectToNxDb,
  IoSnapshotStore,
  getIoSnapshotDeferredTaskIds,
} from '../native';

vi.mock('../tasks-runner/utils', () => ({
  getExecutorForTask: vi.fn((task: { target: { target: string } }) => ({
    hasherFactory: task.target.target === 'custom' ? () => ({}) : undefined,
  })),
}));

import { applyIoSnapshotOutputs } from './outputs';

function node(name: string, root: string, targets: Record<string, any>) {
  return { name, type: 'lib' as const, data: { root, targets } };
}

const projectGraph: ProjectGraph = {
  nodes: {
    web: node('web', 'apps/web', {
      build: { executor: 'nx:run-commands', cache: true },
      lint: {
        executor: 'nx:run-commands',
        cache: true,
        sandbox: { enabled: false },
      },
      custom: { executor: 'nx:run-commands', cache: true },
    }),
    ui: node('ui', 'libs/ui', {
      build: { executor: 'nx:run-commands', cache: true },
    }),
  },
  dependencies: { web: [], ui: [] },
  externalNodes: {},
};

function task(project: string, target: string, outputs: string[] = []) {
  return {
    id: `${project}:${target}`,
    target: { project, target },
    overrides: {},
    outputs,
    projectRoot: projectGraph.nodes[project].data.root,
    cache: true,
    parallelism: true,
  };
}

function graph(
  tasks: ReturnType<typeof task>[],
  dependencies: Record<string, string[]> = {}
): TaskGraph {
  const ids = tasks.map((t) => t.id);
  return {
    roots: ids,
    tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
    dependencies: Object.fromEntries(
      ids.map((id) => [id, dependencies[id] ?? []])
    ),
    continuousDependencies: Object.fromEntries(ids.map((id) => [id, []])),
  };
}

let tempFs: TempFs;
let snapshotDb: ReturnType<typeof connectToNxDb>;
let bundles = 0;

function snapshotsFor(
  entries: Record<string, { inputs?: string[]; outputs?: string[] }>
) {
  const commit = `a${bundles++}`.padEnd(40, 'a');
  new IoSnapshotStore(snapshotDb).import({
    requestedCommit: commit,
    snapshotsJson: JSON.stringify(
      Object.fromEntries(
        Object.entries(entries).map(([id, e]) => [
          id,
          { commit, inputs: e.inputs ?? [], outputs: e.outputs ?? [] },
        ])
      )
    ),
  });
  return new IoSnapshotStore(snapshotDb).get(commit);
}

describe('io snapshot outputs', () => {
  beforeEach(() => {
    tempFs = new TempFs('io-snapshot-outputs');
    snapshotDb = connectToNxDb(join(tempFs.tempDir, 'db'), 'io-snapshots');
  });
  afterEach(() => {
    closeDbConnection(snapshotDb);
    tempFs.cleanup();
  });

  it('unions observed outputs after the declared ones, deduplicated, only for eligible tasks', () => {
    const taskGraph = graph([
      task('web', 'build', ['dist/apps/web', '!dist/apps/web/*.map']),
      task('web', 'lint', ['reports/lint']),
      task('web', 'custom', []),
      task('ui', 'build', ['dist/libs/ui']),
    ]);
    const snapshots = snapshotsFor({
      'web:build': {
        outputs: ['dist/apps/web', 'apps/web/.next/cache/**', '../escape/**'],
      },
      'web:lint': { outputs: ['reports/lint-observed'] },
      'web:custom': { outputs: ['dist/custom'] },
    });

    applyIoSnapshotOutputs(projectGraph, taskGraph, snapshots);
    // The escaping write is dropped; the declared one is not repeated.
    const merged = [
      'dist/apps/web',
      '!dist/apps/web/*.map',
      'apps/web/.next/cache/**',
    ];
    expect(taskGraph.tasks['web:build'].outputs).toEqual(merged);
    // Opted out, custom hasher, and absent entries stay byte-identical.
    expect(taskGraph.tasks['web:lint'].outputs).toEqual(['reports/lint']);
    expect(taskGraph.tasks['web:custom'].outputs).toEqual([]);
    expect(taskGraph.tasks['ui:build'].outputs).toEqual(['dist/libs/ui']);

    // Idempotent.
    applyIoSnapshotOutputs(projectGraph, taskGraph, snapshots);
    expect(taskGraph.tasks['web:build'].outputs).toEqual(merged);
  });

  it('merges into a set, so a declared duplicate collapses too', () => {
    const taskGraph = graph([
      task('web', 'build', ['dist/apps/web', 'dist/apps/web']),
    ]);
    const snapshots = snapshotsFor({
      'web:build': { outputs: ['apps/web/.next/cache/**'] },
    });
    applyIoSnapshotOutputs(projectGraph, taskGraph, snapshots);
    expect(taskGraph.tasks['web:build'].outputs).toEqual([
      'dist/apps/web',
      'apps/web/.next/cache/**',
    ]);
  });

  it('lets a consumer of an observed-only write defer to the second wave', () => {
    const taskGraph = graph(
      [task('ui', 'build', ['dist/libs/ui']), task('web', 'build', [])],
      { 'web:build': ['ui:build'] }
    );
    const snapshots = snapshotsFor({
      'ui:build': { outputs: ['libs/ui/generated/types.d.ts'] },
      'web:build': { inputs: ['libs/ui/generated/types.d.ts'] },
    });
    // Declared outputs alone do not cover the read: no deferral.
    expect(getIoSnapshotDeferredTaskIds(snapshots, taskGraph)).toEqual([]);

    applyIoSnapshotOutputs(projectGraph, taskGraph, snapshots);
    expect(taskGraph.tasks['ui:build'].outputs).toEqual([
      'dist/libs/ui',
      'libs/ui/generated/types.d.ts',
    ]);
    expect(getIoSnapshotDeferredTaskIds(snapshots, taskGraph)).toEqual([
      'web:build',
    ]);
  });
});
