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
import {
  _resetIoSnapshotBundleCache,
  buildIoSnapshotOverrides,
} from './overrides';

function node(name: string, root: string, targets: Record<string, any>) {
  return { name, type: 'lib' as const, data: { root, targets } };
}

const projectGraph: ProjectGraph = {
  nodes: {
    web: node('web', 'apps/web', {
      build: { executor: 'nx:run-commands', cache: true },
      lint: { executor: 'nx:run-commands', cache: 'manual' },
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
    _resetIoSnapshotBundleCache();
    (isIoSnapshotFetchEnabled as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => tempFs.cleanup());

  it('returns null when snapshots are off', () => {
    (isIoSnapshotFetchEnabled as jest.Mock).mockReturnValue(false);
    expect(buildIoSnapshotOverrides(projectGraph, graph('web:build'), {})).toBe(
      null
    );
  });

  it('reports no-bundle when nothing is cached for HEAD', () => {
    expect(
      buildIoSnapshotOverrides(projectGraph, graph('web:build'), {})
    ).toEqual({
      overrides: {},
      diagnostics: [{ reason: 'no-bundle' }],
      resolution: null,
    });
  });

  it('rejects an unknown bundle version without throwing', () => {
    writeBundle({}, 2);
    const result = buildIoSnapshotOverrides(
      projectGraph,
      graph('web:build'),
      {}
    );
    expect(result.overrides).toEqual({});
    expect(result.diagnostics[0]).toMatchObject({ reason: 'invalid-bundle' });
  });

  it('lifts structured entries into overrides with workspace-relative globs', () => {
    writeBundle({
      'web:build': {
        commit: HEAD,
        inputs: {
          projects: {
            web: ['src/**/*.ts', '!src/**/*.spec.ts'],
            ui: ['src/index.ts'],
            root: ['package.json'],
          },
          workspace: ['tsconfig.base.json'],
          taskOutputs: { 'ui:build': ['dist/libs/ui/index.js'] },
        },
        outputs: [],
      },
      'root:build': { commit: HEAD, inputs: {}, outputs: [] },
    });
    const result = buildIoSnapshotOverrides(
      projectGraph,
      graph('web:build', 'ui:build', 'root:build'),
      {}
    );
    expect(result.overrides['web:build']).toEqual({
      projects: {
        web: ['apps/web/src/**/*.ts', '!apps/web/src/**/*.spec.ts'],
        ui: ['libs/ui/src/index.ts'],
        root: ['package.json'],
      },
      workspace: ['tsconfig.base.json'],
      taskOutputs: { 'ui:build': ['dist/libs/ui/index.js'] },
      digest: 'd1',
    });
    // An entry that read nothing is still an override.
    expect(result.overrides['root:build']).toEqual({
      projects: {},
      workspace: [],
      taskOutputs: {},
      digest: 'd1',
    });
    expect(result.diagnostics).toEqual([
      { reason: 'missing', taskId: 'ui:build' },
    ]);
    expect(result.resolution.digest).toBe('d1');
  });

  it('withholds overrides for manual, custom-hasher, flat, and dangling entries', () => {
    writeBundle({
      'web:build': {
        commit: HEAD,
        inputs: { taskOutputs: { 'gone:build': ['dist/x'] } },
        outputs: [],
      },
      'web:lint': { commit: HEAD, inputs: {}, outputs: [] },
      'web:custom': { commit: HEAD, inputs: {}, outputs: [] },
      'ui:build': { commit: HEAD, inputs: ['libs/ui/src/**'], outputs: [] },
      'root:build': {
        commit: HEAD,
        inputs: { projects: { nope: ['x'] } },
        outputs: [],
      },
    });
    const result = buildIoSnapshotOverrides(
      projectGraph,
      graph('web:build', 'web:lint', 'web:custom', 'ui:build', 'root:build'),
      {}
    );
    expect(result.overrides).toEqual({});
    expect(result.diagnostics).toEqual([
      {
        reason: 'producer-not-in-graph',
        taskId: 'web:build',
        producer: 'gone:build',
      },
      { reason: 'manual', taskId: 'web:lint' },
      { reason: 'custom-hasher', taskId: 'web:custom' },
      { reason: 'unclassified', taskId: 'ui:build' },
      { reason: 'unknown-project', taskId: 'root:build', project: 'nope' },
    ]);
  });

  it('re-reads the bundle only when the file changes', () => {
    writeBundle({ 'web:build': { commit: HEAD, inputs: {}, outputs: [] } });
    const first = buildIoSnapshotOverrides(
      projectGraph,
      graph('web:build'),
      {}
    );
    expect(Object.keys(first.overrides)).toEqual(['web:build']);
    // Same mtime ⇒ cached parse; a rewrite with a new mtime is picked up.
    const file = join(cacheRoot, HEAD, 'snapshots.json');
    const { utimesSync } = require('fs');
    writeBundle({});
    utimesSync(file, new Date(Date.now() + 5000), new Date(Date.now() + 5000));
    const second = buildIoSnapshotOverrides(
      projectGraph,
      graph('web:build'),
      {}
    );
    expect(second.overrides).toEqual({});
  });
});
