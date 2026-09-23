import { join } from 'path';
import { TempFs } from '../internal-testing-utils/temp-fs';
import type { ProjectGraph } from '../config/project-graph';
import type { TaskGraph } from '../config/task-graph';

const HEAD = 'a'.repeat(40);
let snapshotDb: ReturnType<typeof connectToNxDb>;

vi.mock('../tasks-runner/utils', () => ({
  getExecutorForTask: vi.fn((task: { target: { target: string } }) => ({
    hasherFactory: task.target.target === 'custom' ? () => ({}) : undefined,
  })),
}));

import { closeDbConnection, connectToNxDb, IoSnapshotStore } from '../native';
import { buildIoSnapshotOverrides } from './overrides';

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
    root: node('root', '.', {
      build: { executor: 'nx:run-commands', cache: true },
    }),
  },
  dependencies: { web: [], ui: [], root: [] },
  externalNodes: {},
};

function task(project: string, target: string) {
  return {
    id: `${project}:${target}`,
    target: { project, target },
    overrides: {},
    outputs: [],
    projectRoot: projectGraph.nodes[project].data.root,
    cache: true,
    parallelism: true,
  };
}

function graph(...ids: string[]): TaskGraph {
  const tasks = Object.fromEntries(
    ids.map((id) => {
      const [project, target] = id.split(':');
      return [id, task(project, target)];
    })
  );
  return {
    roots: ids,
    tasks,
    dependencies: Object.fromEntries(ids.map((id) => [id, []])),
    continuousDependencies: Object.fromEntries(ids.map((id) => [id, []])),
  };
}

function writeBundle(snapshots: Record<string, unknown>) {
  return new IoSnapshotStore(snapshotDb).import({
    requestedCommit: HEAD,
    snapshotsJson: JSON.stringify(snapshots),
  });
}

describe('buildIoSnapshotOverrides', () => {
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('io-snapshot-overrides');
    snapshotDb = connectToNxDb(join(tempFs.tempDir, 'db'), 'io-snapshots');
  });

  afterEach(() => {
    closeDbConnection(snapshotDb);
    tempFs.cleanup();
  });

  it('uses flat entries, including one that read nothing', () => {
    const set = writeBundle({
      'web:build': {
        commit: HEAD,
        inputs: ['apps/web/src/**/*.ts', 'dist/libs/ui/index.js'],
        outputs: [],
      },
      'root:build': { commit: HEAD, inputs: [], outputs: [] },
    });
    const result = buildIoSnapshotOverrides(
      projectGraph,
      graph('web:build', 'ui:build', 'root:build'),
      set
    );
    expect(result.used).toEqual(['root:build', 'web:build']);
    expect(result.diagnostics.map((d) => [d.reason, d.taskId])).toEqual([
      ['missing', 'ui:build'],
    ]);
  });

  it('withholds disabled, custom-hasher, and root-anchored tasks', () => {
    const set = writeBundle({
      'web:lint': { commit: HEAD, inputs: [], outputs: [] },
      'web:custom': { commit: HEAD, inputs: [], outputs: [] },
      'ui:build': {
        commit: HEAD,
        inputs: ['libs/ui/a.ts', '**/*.gen'],
        outputs: [],
      },
    });
    const result = buildIoSnapshotOverrides(
      projectGraph,
      graph('web:lint', 'web:custom', 'ui:build'),
      set
    );
    expect(result.used).toEqual([]);
    expect(result.diagnostics.map((d) => [d.reason, d.taskId])).toEqual([
      ['root-anchored-glob', 'ui:build'],
      ['custom-hasher', 'web:custom'],
      ['disabled', 'web:lint'],
    ]);
    expect(result.diagnostics[0].glob).toBe('**/*.gen');
  });
});
