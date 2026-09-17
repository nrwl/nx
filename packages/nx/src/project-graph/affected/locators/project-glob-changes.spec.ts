import { ProjectGraphProjectNode } from '../../../config/project-graph';
import { DeletedFileChange } from '../../file-utils';
import { getTouchedProjectsFromProjectGlobChanges } from './project-glob-changes';
const mocks = vi.hoisted(() => ({
  capabilitiesOfConfiguredPlugins: vi.fn(),
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
  capabilitiesOfConfiguredPlugins: mocks.capabilitiesOfConfiguredPlugins,
}));

beforeEach(() => {
  mocks.deleted.clear();
  // Where those capabilities came from, records or a load, is settled inside
  // `capabilitiesOfConfiguredPlugins` and is its spec's business.
  mocks.capabilitiesOfConfiguredPlugins.mockReset();
  mocks.capabilitiesOfConfiguredPlugins.mockResolvedValue([
    {
      name: 'test',
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

    // A modified project configuration marks its own project through its root,
    // so this locator has nothing to add, and the patterns it would match
    // against cost a plugin load to work out.
    expect(result).toEqual([]);
    expect(mocks.capabilitiesOfConfiguredPlugins).not.toHaveBeenCalled();
  });

  it('ignores a plugin that registers no createNodes', async () => {
    // The only plugin, so nothing else contributes a pattern: whatever this
    // locator matches against is what an absent `createNodesPattern` turned
    // into. Dropped rather than combined, or the literal `undefined` becomes a
    // pattern of its own and a file by that name deletes the whole workspace.
    mocks.capabilitiesOfConfiguredPlugins.mockResolvedValue([
      {
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
        name: 'test',
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
