import { ProjectGraphProjectNode } from '../../../config/project-graph';
import { DeletedFileChange } from '../../file-utils';
import { getTouchedProjectsFromProjectGlobChanges } from './project-glob-changes';
jest.mock('../../../project-graph/plugins/get-plugins', () => ({
  ...jest.requireActual('../../../project-graph/plugins/get-plugins'),
  getPlugins: async () => {
    return [
      {
        name: 'test',
        createNodes: [
          '**/project.json',
          async () => {
            return [];
          },
        ],
      },
    ];
  },
}));

describe('getTouchedProjectsFromProjectGlobChanges', () => {
  it('should affect all projects if a project is removed', async () => {
    const nodes = {
      proj1: makeProjectGraphNode('proj1'),
      proj2: makeProjectGraphNode('proj2'),
      proj3: makeProjectGraphNode('proj3'),
    };
    const result = await getTouchedProjectsFromProjectGlobChanges(
      [
        {
          file: 'libs/proj1/project.json',
          hash: 'some-hash',
          getChanges: () => [new DeletedFileChange()],
        },
      ],
      nodes,
      {
        plugins: [],
      },
      {},
      {
        nodes: nodes,
        dependencies: {},
      }
    );
    expect(result).toEqual(['proj1', 'proj2', 'proj3']);
  });
});

function makeProjectGraphNode(name): ProjectGraphProjectNode {
  return {
    data: {
      root: `libs/${name}`,
    },
    name,
    type: 'lib',
  };
}
