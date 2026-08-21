import type { ProjectGraph } from '../../config/project-graph';
import { DeletedFileChange } from '../file-utils';
import { filterAffected } from './affected-project-graph';

vi.mock('../plugins/get-plugins', async () => ({
  ...(await vi.importActual('../plugins/get-plugins')),
  getPlugins: async () => [
    {
      name: 'test',
      createNodes: [
        '**/project.json',
        async () => {
          return [];
        },
      ],
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
