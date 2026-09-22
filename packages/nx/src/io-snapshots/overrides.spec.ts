import type { Mock } from 'vitest';
import { join } from 'path';
import { TempFs } from '../internal-testing-utils/temp-fs';
import type { ProjectGraph } from '../config/project-graph';
import type { TaskGraph } from '../config/task-graph';

const HEAD = 'a'.repeat(40);
let snapshotDb: ReturnType<typeof connectToNxDb>;

vi.mock('../utils/git-utils', () => ({
  getLatestCommitSha: vi.fn(() => HEAD),
}));
vi.mock('./config', () => ({
  ioSnapshotCommitForHead: () => HEAD,
  isIoSnapshotFetchEnabled: vi.fn(() => true),
}));
vi.mock('../utils/db-connection', () => ({
  getDbConnection: () => snapshotDb,
}));
vi.mock('../tasks-runner/utils', () => ({
  getExecutorForTask: vi.fn((task: { target: { target: string } }) => ({
    hasherFactory: task.target.target === 'custom' ? () => ({}) : undefined,
  })),
}));

import { closeDbConnection, connectToNxDb, IoSnapshotStore } from '../native';
import { isIoSnapshotFetchEnabled } from './config';
import { buildIoSnapshotOverrides, getIoSnapshotsForHead } from './overrides';

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
  new IoSnapshotStore(snapshotDb).import({
    requestedCommit: HEAD,
    commits: [HEAD],
    clientVersion: 'nx/test',
    snapshotsJson: JSON.stringify(snapshots),
  });
}

describe('buildIoSnapshotOverrides', () => {
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('io-snapshot-overrides');
    snapshotDb = connectToNxDb(join(tempFs.tempDir, 'db'), 'io-snapshots');
    (isIoSnapshotFetchEnabled as Mock).mockReturnValue(true);
  });

  afterEach(() => {
    closeDbConnection(snapshotDb);
    tempFs.cleanup();
  });

  it('returns null when snapshots are off', () => {
    (isIoSnapshotFetchEnabled as Mock).mockReturnValue(false);
    expect(getIoSnapshotsForHead({})).toBeNull();
    expect(buildIoSnapshotOverrides(projectGraph, graph('web:build'), {})).toBe(
      null
    );
  });

  it('reports no-bundle when nothing is cached for HEAD', () => {
    expect(getIoSnapshotsForHead({})).toMatchObject({
      status: 'skipped',
      reason: 'no-bundle',
    });
    const result = buildIoSnapshotOverrides(
      projectGraph,
      graph('web:build'),
      {}
    );
    expect(result.used).toEqual([]);
    expect(result.resolution).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({ reason: 'no-bundle' });
  });

  it('uses flat entries, including one that read nothing', () => {
    writeBundle({
      'web:build': {
        commit: HEAD,
        inputs: ['apps/web/src/**/*.ts', 'dist/libs/ui/index.js'],
        taskOutputs: { 'ui:build': ['dist/libs/ui/index.js'] },
        outputs: [],
      },
      'root:build': { commit: HEAD, inputs: [], outputs: [] },
    });
    const result = buildIoSnapshotOverrides(
      projectGraph,
      graph('web:build', 'ui:build', 'root:build'),
      {}
    );
    expect(result.used).toEqual(['root:build', 'web:build']);
    expect(result.diagnostics.map((d) => [d.reason, d.taskId])).toEqual([
      ['missing', 'ui:build'],
    ]);
    expect(result.resolution.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('flattens legacy bucketed entries, and withholds one that names a project the graph no longer has', () => {
    writeBundle({
      'web:build': {
        commit: HEAD,
        inputs: {
          projects: { web: ['src/**/*.ts'], gone: ['x.ts'] },
          workspace: ['tsconfig.base.json'],
          taskOutputs: {},
        },
        outputs: [],
      },
    });
    // A renamed project would otherwise leave its reads out of the plan and
    // replay a stale hit after an edit under the old root.
    const withheld = buildIoSnapshotOverrides(
      projectGraph,
      graph('web:build'),
      {}
    );
    expect(withheld.used).toEqual([]);
    expect(withheld.diagnostics).toEqual([
      expect.objectContaining({
        reason: 'unknown-project',
        taskId: 'web:build',
        project: 'gone',
      }),
    ]);

    writeBundle({
      'web:build': {
        commit: HEAD,
        inputs: {
          projects: { web: ['src/**/*.ts'] },
          workspace: ['tsconfig.base.json'],
          taskOutputs: {},
        },
        outputs: [],
      },
    });
    const flattened = buildIoSnapshotOverrides(
      projectGraph,
      graph('web:build'),
      {}
    );
    expect(flattened.used).toEqual(['web:build']);
    expect(flattened.diagnostics).toEqual([]);
  });

  it('withholds disabled, custom-hasher, dangling, and root-anchored tasks', () => {
    writeBundle({
      'web:build': {
        commit: HEAD,
        inputs: ['dist/x'],
        taskOutputs: { 'gone:build': ['dist/x'] },
        outputs: [],
      },
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
      graph('web:build', 'web:lint', 'web:custom', 'ui:build'),
      {}
    );
    expect(result.used).toEqual([]);
    expect(result.diagnostics.map((d) => [d.reason, d.taskId])).toEqual([
      ['root-anchored-glob', 'ui:build'],
      ['producer-not-in-graph', 'web:build'],
      ['custom-hasher', 'web:custom'],
      ['disabled', 'web:lint'],
    ]);
    expect(result.diagnostics[0].glob).toBe('**/*.gen');
    expect(result.diagnostics[1].producer).toBe('gone:build');
  });

  it('accepts a commit or a set', () => {
    writeBundle({ 'web:build': { commit: HEAD, inputs: [], outputs: [] } });
    const byDir = buildIoSnapshotOverrides(
      projectGraph,
      graph('web:build'),
      {},
      HEAD
    );
    const byHandle = buildIoSnapshotOverrides(
      projectGraph,
      graph('web:build'),
      {},
      new IoSnapshotStore(snapshotDb).get(HEAD)
    );
    expect(byDir.used).toEqual(['web:build']);
    expect(byHandle).toEqual(byDir);
  });
});
