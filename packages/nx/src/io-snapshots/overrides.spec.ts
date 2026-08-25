import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TempFs } from '../internal-testing-utils/temp-fs';
import type { ProjectGraph } from '../config/project-graph';
import type { TaskGraph } from '../config/task-graph';

const HEAD = 'a'.repeat(40);
let cacheRoot: string;

jest.mock('../utils/git-utils', () => ({
  getLatestCommitSha: jest.fn(() => HEAD),
}));
jest.mock('./fetch', () => ({
  get ioSnapshotsCacheDirectory() {
    return cacheRoot;
  },
  isIoSnapshotFetchEnabled: jest.fn(() => true),
}));
jest.mock('../tasks-runner/utils', () => ({
  getCustomHasher: jest.fn((task: { target: { target: string } }) =>
    task.target.target === 'custom' ? () => ({}) : null
  ),
}));

import { isIoSnapshotFetchEnabled } from './fetch';
import { buildIoSnapshotOverrides, loadIoSnapshotsForHead } from './overrides';

function node(name: string, root: string, targets: Record<string, any>) {
  return { name, type: 'lib' as const, data: { root, targets } };
}

const projectGraph: ProjectGraph = {
  nodes: {
    web: node('web', 'apps/web', {
      build: { executor: 'nx:run-commands', cache: true },
      lint: { executor: 'nx:run-commands', cache: true, ioSnapshots: false },
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

function writeBundle(snapshots: Record<string, unknown>, version = 1) {
  const dir = join(cacheRoot, HEAD);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'snapshots.json'),
    JSON.stringify({
      version,
      resolution: {
        requestedCommit: HEAD,
        commits: [HEAD],
        sourceCommits: [HEAD],
        digest: 'd1',
        fetchedAt: 1,
        clientVersion: 'nx/test',
        tasks: Object.keys(snapshots).length,
      },
      snapshots,
    })
  );
}

describe('buildIoSnapshotOverrides', () => {
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('io-snapshot-overrides');
    cacheRoot = join(tempFs.tempDir, 'io-snapshots');
    (isIoSnapshotFetchEnabled as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => tempFs.cleanup());

  it('returns null when snapshots are off', () => {
    (isIoSnapshotFetchEnabled as jest.Mock).mockReturnValue(false);
    expect(loadIoSnapshotsForHead({})).toBeNull();
    expect(buildIoSnapshotOverrides(projectGraph, graph('web:build'), {})).toBe(
      null
    );
  });

  it('reports no-bundle when nothing is cached for HEAD', () => {
    const snapshots = loadIoSnapshotsForHead({});
    expect(snapshots.status).toBe('skipped');
    expect(snapshots.reason).toBe('no-bundle');
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

  it('rejects an unknown bundle version without throwing', () => {
    writeBundle({}, 2);
    const result = buildIoSnapshotOverrides(
      projectGraph,
      graph('web:build'),
      {}
    );
    expect(result.used).toEqual([]);
    expect(result.diagnostics[0]).toMatchObject({
      reason: 'invalid-bundle',
      file: expect.stringContaining('snapshots.json'),
    });
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
    expect(result.resolution.digest).toBe('d1');
  });

  it('flattens legacy bucketed entries and skips unknown projects', () => {
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
    const result = buildIoSnapshotOverrides(
      projectGraph,
      graph('web:build'),
      {}
    );
    expect(result.used).toEqual(['web:build']);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        reason: 'unknown-project',
        taskId: 'web:build',
        project: 'gone',
      }),
    ]);
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

  it('accepts a bundle directory or a loaded handle', () => {
    writeBundle({ 'web:build': { commit: HEAD, inputs: [], outputs: [] } });
    const dir = join(cacheRoot, HEAD);
    const byDir = buildIoSnapshotOverrides(
      projectGraph,
      graph('web:build'),
      {},
      dir
    );
    const byHandle = buildIoSnapshotOverrides(
      projectGraph,
      graph('web:build'),
      {},
      loadIoSnapshotsForHead({})
    );
    expect(byDir.used).toEqual(['web:build']);
    expect(byHandle).toEqual(byDir);
  });
});
