import { ProjectGraphProjectNode } from '../../../config/project-graph';
import { DeletedFileChange } from '../../file-utils';
import { getTouchedProjectsFromProjectGlobChanges } from './project-glob-changes';
const mocks = vi.hoisted(() => ({
  capabilitiesOfConfiguredPlugins: vi.fn(),
  deleted: new Set<string>(),
}));

vi.mock('../../file-utils', async () => ({
  ...(await vi.importActual<typeof import('../../file-utils')>(
    '../../file-utils'
  )),
  isDeletedFile: (file: string) => mocks.deleted.has(file),
}));

function deletedFile(file: string) {
  mocks.deleted.add(file);
  return { file, getChanges: () => [new DeletedFileChange()] };
}

function modifiedFile(file: string) {
  return {
    file,
    getChanges: () => {
      throw new Error(`getChanges() was called for ${file}`);
    },
  };
}

vi.mock('../../../project-graph/plugins/get-plugins', async () => ({
  ...(await vi.importActual('../../../project-graph/plugins/get-plugins')),
  capabilitiesOfConfiguredPlugins: mocks.capabilitiesOfConfiguredPlugins,
}));

beforeEach(() => {
  mocks.deleted.clear();
  mocks.capabilitiesOfConfiguredPlugins.mockReset();
  mocks.capabilitiesOfConfiguredPlugins.mockResolvedValue([
    {
      createNodesPattern: '**/project.json',
      hasCreateDependencies: false,
      hasCreateMetadata: false,
      hasPreTasksExecution: false,
      hasPostTasksExecution: false,
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
      [deletedFile('libs/proj1/project.json')],
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
      [deletedFile('libs/removed/project.json')],
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
  it('asks the plugins nothing when no file was deleted', async () => {
    const nodes = { proj1: makeProjectGraphNode('proj1') };

    const result = await getTouchedProjectsFromProjectGlobChanges(
      [modifiedFile('libs/proj1/project.json')],
      nodes,
      { plugins: [] },
      {},
      { nodes, dependencies: {} }
    );

    expect(result).toEqual([]);
    expect(mocks.capabilitiesOfConfiguredPlugins).not.toHaveBeenCalled();
  });

  it('ignores a plugin that registers no createNodes', async () => {
    // Without the filter, a lone absent pattern reaches minimatch, which throws.
    mocks.capabilitiesOfConfiguredPlugins.mockResolvedValue([
      {
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
      [deletedFile('undefined')],
      nodes,
      { plugins: [] },
      {},
      { nodes, dependencies: {} }
    );

    expect(result).toEqual([]);
  });

  it('matches against the patterns on record', async () => {
    mocks.capabilitiesOfConfiguredPlugins.mockResolvedValue([
      {
        createNodesPattern: '**/project.json',
        hasCreateDependencies: false,
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
      [deletedFile('libs/proj1/project.json')],
      nodes,
      { plugins: [] },
      {},
      { nodes, dependencies: {} }
    );

    expect(result).toEqual(['proj1', 'proj2']);
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
