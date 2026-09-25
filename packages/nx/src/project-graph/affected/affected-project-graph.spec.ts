import type { ProjectGraph } from '../../config/project-graph';
import { DeletedFileChange, WholeFileChange } from '../file-utils';
import {
  filterAffected,
  filterAffectedWithReasons,
} from './affected-project-graph';
import { runTouchedProjectLocators } from './affected-projects';

vi.mock('../plugins/get-plugins', async () => ({
  ...(await vi.importActual('../plugins/get-plugins')),
  capabilitiesOfConfiguredPlugins: async () => [
    {
      createNodesPattern: '**/project.json',
      hasCreateDependencies: false,
      hasCreateMetadata: false,
      hasPreTasksExecution: false,
      hasPostTasksExecution: false,
    },
  ],
}));

describe('filterAffected()', () => {
  const projectGraph: ProjectGraph = {
    nodes: {
      'current-a': {
        name: 'current-a',
        type: 'lib',
        data: { root: 'libs/current-a' },
      },
      'current-b': {
        name: 'current-b',
        type: 'lib',
        data: { root: 'libs/current-b' },
      },
    },
    externalNodes: {},
    dependencies: {
      'current-a': [],
      'current-b': [],
    },
  };

  const nxJson = { plugins: [] } as any;

  it('can disable the fallback which affects every project on deletion', async () => {
    const result = await filterAffected(
      projectGraph,
      [
        {
          file: 'libs/retired/project.json',
          getChanges: () => [new DeletedFileChange()],
        },
      ],
      nxJson,
      {},
      false
    );

    expect(result.nodes).toEqual({});
  });

  /**
   * The chain the deletion fallback rests on: the plugins' createNodes globs
   * come from getProjectGlobPatterns, Rust matches the deleted path against
   * them, and every project comes back.
   */
  it('marks every project affected when a project config is deleted', async () => {
    const result = await filterAffected(
      projectGraph,
      [
        {
          file: 'libs/retired/project.json',
          getChanges: () => [new DeletedFileChange()],
        },
      ],
      nxJson,
      {}
    );

    expect(Object.keys(result.nodes).sort()).toEqual([
      'current-a',
      'current-b',
    ]);
  });

  it('still runs other locators when the deletion fallback is disabled', async () => {
    const result = await filterAffected(
      projectGraph,
      [
        {
          file: 'libs/current-a/project.json',
          getChanges: () => [new DeletedFileChange()],
        },
      ],
      nxJson,
      {},
      false
    );

    expect(Object.keys(result.nodes)).toEqual(['current-a']);
  });

  it('includes dependents of every installed version for an override change', async () => {
    const graph: ProjectGraph = {
      nodes: {
        'uses-version-1': {
          name: 'uses-version-1',
          type: 'lib',
          data: { root: 'libs/uses-version-1' },
        },
        'uses-version-2': {
          name: 'uses-version-2',
          type: 'lib',
          data: { root: 'libs/uses-version-2' },
        },
        unrelated: {
          name: 'unrelated',
          type: 'lib',
          data: { root: 'libs/unrelated' },
        },
      },
      externalNodes: {
        'npm:happy-nrwl@1': {
          name: 'npm:happy-nrwl@1',
          type: 'npm',
          data: { packageName: 'happy-nrwl', version: '1' },
        },
        'npm:happy-nrwl@2': {
          name: 'npm:happy-nrwl@2',
          type: 'npm',
          data: { packageName: 'happy-nrwl', version: '2' },
        },
      },
      dependencies: {
        'uses-version-1': [
          {
            source: 'uses-version-1',
            target: 'npm:happy-nrwl@1',
            type: 'static',
          },
        ],
        'uses-version-2': [
          {
            source: 'uses-version-2',
            target: 'npm:happy-nrwl@2',
            type: 'static',
          },
        ],
        unrelated: [],
        'npm:happy-nrwl@1': [],
        'npm:happy-nrwl@2': [],
      },
    };

    const result = await filterAffected(
      graph,
      [
        {
          file: 'package.json',
          getChanges: () => [
            {
              type: 'JsonPropertyModified',
              path: ['overrides', 'happy-nrwl@^1'],
              value: { lhs: '1.0.0', rhs: '2.0.0' },
            },
          ],
        },
      ],
      nxJson,
      { overrides: { 'happy-nrwl@^1': '2.0.0' } }
    );

    expect(Object.keys(result.nodes).sort()).toEqual([
      'uses-version-1',
      'uses-version-2',
    ]);
    expect(Object.keys(result.externalNodes).sort()).toEqual([
      'npm:happy-nrwl@1',
      'npm:happy-nrwl@2',
    ]);
  });
});

describe('filterAffectedWithReasons()', () => {
  const nxJson = { plugins: [] } as any;
  // app reaches ui by two edges, and ui uses an external.
  const graph: ProjectGraph = {
    nodes: {
      ui: { name: 'ui', type: 'lib', data: { root: 'libs/ui' } },
      app: { name: 'app', type: 'app', data: { root: 'apps/app' } },
    },
    externalNodes: {
      'npm:happy-nrwl': {
        name: 'npm:happy-nrwl',
        type: 'npm',
        data: { packageName: 'happy-nrwl', version: '1' },
      },
    },
    dependencies: {
      ui: [{ source: 'ui', target: 'npm:happy-nrwl', type: 'static' }],
      app: [
        { source: 'app', target: 'ui', type: 'static' },
        { source: 'app', target: 'ui', type: 'implicit' },
      ],
      'npm:happy-nrwl': [],
    },
  };
  const packageBump = [
    {
      file: 'package.json',
      getChanges: () => [
        {
          type: 'JsonPropertyModified',
          path: ['dependencies', 'happy-nrwl'],
          value: { lhs: '1.0.0', rhs: '2.0.0' },
        },
      ],
    },
  ] as any;
  const packageJson = { dependencies: { 'happy-nrwl': '2.0.0' } };

  it('reports each dependency edge once, however many join the pair', async () => {
    const { reasons } = await filterAffectedWithReasons(
      graph,
      [
        {
          file: 'libs/ui/src/index.ts',
          getChanges: () => [new WholeFileChange()],
        },
      ],
      nxJson,
      {}
    );
    expect(reasons).toEqual({
      ui: [{ kind: 'project-file', file: 'libs/ui/src/index.ts' }],
      app: [{ kind: 'dependency', dependency: 'ui' }],
    });
  });

  // The JS locators return through the napi struct, which drops any field it
  // does not declare.
  it('keeps the package name a JS locator reports across napi', async () => {
    const touched = await runTouchedProjectLocators(
      graph,
      packageBump,
      nxJson,
      packageJson
    );
    expect(touched).toContainEqual({
      project: 'npm:happy-nrwl',
      kind: 'npm-package',
      package: 'npm:happy-nrwl',
      file: 'package.json',
    });
  });

  it('names the package a project reached, and lists no external', async () => {
    const { reasons } = await filterAffectedWithReasons(
      graph,
      packageBump,
      nxJson,
      packageJson
    );
    expect(Object.keys(reasons).sort()).toEqual(['app', 'ui']);
    expect(reasons.ui).toEqual([
      { kind: 'npm-package', package: 'npm:happy-nrwl' },
    ]);
  });
});
