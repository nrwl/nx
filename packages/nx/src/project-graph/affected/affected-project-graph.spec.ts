import type { ProjectGraph } from '../../config/project-graph';
import { DeletedFileChange } from '../file-utils';
import { filterAffected } from './affected-project-graph';

jest.mock('../plugins/get-plugins', () => ({
  ...jest.requireActual('../plugins/get-plugins'),
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
});
