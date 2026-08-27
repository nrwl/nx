import { ProjectGraphProjectNode } from '../../../config/project-graph';
import { DeletedFileChange } from '../../file-utils';
import { getTouchedProjectsFromProjectGlobChanges } from './project-glob-changes';
vi.mock('../../../project-graph/plugins/get-plugins', async () => ({
  ...(await vi.importActual('../../../project-graph/plugins/get-plugins')),
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

  it('should allow the conservative project deletion fallback to be disabled', async () => {
    const nodes = {
      proj1: makeProjectGraphNode('proj1'),
      proj2: makeProjectGraphNode('proj2'),
      proj3: makeProjectGraphNode('proj3'),
    };
    const result = await getTouchedProjectsFromProjectGlobChanges(
      [
        {
          file: 'libs/removed/project.json',
          getChanges: () => [new DeletedFileChange()],
        },
      ],
      nodes,
      {
        plugins: [],
      },
      {},
      {
        nodes,
        dependencies: {},
      },
      false
    );

    expect(result).toEqual([]);
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
