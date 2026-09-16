import { ProjectGraphProjectNode } from '../../../config/project-graph';
import { DeletedFileChange } from '../../file-utils';
import { getTouchedProjectsFromProjectGlobChanges } from './project-glob-changes';
const mocks = vi.hoisted(() => ({
  peekPluginCapabilities: vi.fn(),
  getPlugins: vi.fn(),
  deleted: new Set<string>(),
}));

// The locator asks whether each touched path is still there, which is what the
// change sets are built from too.
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
      // Evaluating a change set for a file that still exists reads it at two
      // revisions and parses both. Every other locator pays that for one file;
      // this one would pay it for every touched file.
      throw new Error(`getChanges() was called for ${file}`);
    },
  };
}

vi.mock('../../../project-graph/plugins/get-plugins', async () => ({
  ...(await vi.importActual('../../../project-graph/plugins/get-plugins')),
  peekPluginCapabilities: mocks.peekPluginCapabilities,
  getPlugins: mocks.getPlugins,
}));

beforeEach(() => {
  mocks.deleted.clear();
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

    // A modified project configuration marks its own project through its root,
    // so this locator has nothing to add, and the patterns it would match
    // against cost a plugin load to work out.
    expect(result).toEqual([]);
    expect(mocks.peekPluginCapabilities).not.toHaveBeenCalled();
    expect(mocks.getPlugins).not.toHaveBeenCalled();
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
      [deletedFile('libs/proj1/project.json')],
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
