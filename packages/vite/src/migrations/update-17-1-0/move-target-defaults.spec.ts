import { createTree } from '@nx/devkit/testing';
import {
  addProjectConfiguration as _addProjectConfiguration,
  ProjectGraph,
  readNxJson,
  Tree,
  writeJson,
} from '@nx/devkit';

import update from './move-target-defaults';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));

function addProjectConfiguration(tree, name, project) {
  _addProjectConfiguration(tree, name, project);
  projectGraph.nodes[name] = {
    name: name,
    type: 'lib',
    data: {
      root: project.root,
      targets: project.targets,
    },
  };
}

describe('move-target-defaults migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
    writeJson(tree, 'nx.json', {
      namedInputs: {
        production: ['default'],
      },
      targetDefaults: {
        test: {
          cache: true,
          inputs: ['default', '^production'],
        },
      },
    });

    projectGraph = {
      nodes: {},
      dependencies: {},
      externalNodes: {},
    };
  });

  it('should add options to nx.json target defaults and remove them from projects', async () => {
    addProjectConfiguration(tree, 'proj1', {
      root: 'proj1',
      targets: {
        test: {
          executor: '@nx/vite:test',
          options: {
            passWithNoTests: true,
            reportsDirectory: '../../reports',
          },
        },
      },
    });

    await update(tree);

    expect(readNxJson(tree).targetDefaults).toEqual({
      '@nx/vite:test': {
        cache: true,
        inputs: ['default', '^production'],
      },
    });
  });
});
