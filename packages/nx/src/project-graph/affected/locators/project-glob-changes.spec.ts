import { ProjectGraphProjectNode } from '../../../config/project-graph';
import { DeletedFileChange } from '../../file-utils';
import { getTouchedProjectsFromProjectGlobChanges } from './project-glob-changes';
const mocks = vi.hoisted(() => ({
  peekPluginCapabilities: vi.fn(),
  getPlugins: vi.fn(),
}));

vi.mock('../../../project-graph/plugins/get-plugins', async () => ({
  ...(await vi.importActual('../../../project-graph/plugins/get-plugins')),
  peekPluginCapabilities: mocks.peekPluginCapabilities,
  getPlugins: mocks.getPlugins,
}));

beforeEach(() => {
  // No record for some plugin, so the locator loads them. The recorded case
  // has its own test below.
  mocks.peekPluginCapabilities.mockReset();
  mocks.peekPluginCapabilities.mockResolvedValue(null);
  mocks.getPlugins.mockReset();
  mocks.getPlugins.mockResolvedValue([
    {
      name: 'test',
      createNodes: [
        '**/project.json',
        async () => {
          return [];
        },
      ],
    },
  ]);
});

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
  it('matches against the patterns on record, without loading a plugin', async () => {
    mocks.peekPluginCapabilities.mockResolvedValue([
      {
        name: 'test',
        createNodesPattern: '**/project.json',
        hasCreateDependencies: false,
        hasCreateMetadata: false,
        hasPreTasksExecution: false,
        hasPostTasksExecution: false,
      },
      {
        // Registers no createNodes, so it contributes no pattern.
        name: 'inert',
        createNodesPattern: undefined,
        hasCreateDependencies: true,
        hasCreateMetadata: false,
        hasPreTasksExecution: false,
        hasPostTasksExecution: false,
      },
    ]);
    const nodes = {
      proj1: makeProjectGraphNode('proj1'),
      proj2: makeProjectGraphNode('proj2'),
    };

    const result = await getTouchedProjectsFromProjectGlobChanges(
      [
        {
          file: 'libs/proj1/project.json',
          getChanges: () => [new DeletedFileChange()],
        },
      ],
      nodes,
      { plugins: [] },
      {},
      { nodes, dependencies: {} }
    );

    // The deleted config file matched the recorded pattern, which is what
    // triggers the conservative fallback.
    expect(result).toEqual(['proj1', 'proj2']);
    expect(mocks.getPlugins).not.toHaveBeenCalled();
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
