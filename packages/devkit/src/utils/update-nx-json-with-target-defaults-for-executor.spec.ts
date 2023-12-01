import { createTree } from '@nx/devkit/testing';
import {
  getExecutorTargets,
  updateNxJsonWithTargetDefaultsForExecutor,
} from './update-nx-json-with-target-defaults-for-executor';
import {
  addProjectConfiguration as _addProjectConfiguration,
  ProjectGraph,
  readNxJson,
  Tree,
  updateNxJson,
  writeJson,
} from 'nx/src/devkit-exports';

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

describe('updateNxJsonWithTargetDefaultsForExecutor', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();

    writeJson(tree, 'nx.json', {
      namedInputs: {
        production: ['default'],
      },
      targetDefaults: {},
    });

    projectGraph = {
      nodes: {},
      dependencies: {},
      externalNodes: {},
    };
  });

  it('should use existing target defaults if all targets which use the executor use the same name', async () => {
    let nxJson = readNxJson(tree);
    nxJson.targetDefaults['echo'] = {
      cache: false,
      inputs: ['default', '^production', '{workspaceRoot}/other-file.txt'],
      options: {
        watch: false,
      },
    };
    updateNxJson(tree, nxJson);

    addProjectConfiguration(tree, 'proj1', {
      root: 'proj1',
      targets: {
        echo: {
          executor: 'plugin:my-executor',
          options: {
            watch: true,
          },
        },
      },
    });

    const targetNames = getExecutorTargets(projectGraph, 'plugin:my-executor');

    nxJson = updateNxJsonWithTargetDefaultsForExecutor(
      tree,
      nxJson,
      projectGraph,
      'plugin:my-executor',
      {
        cache: true,
        inputs: ['default'],
      },
      targetNames
    );

    expect(nxJson.targetDefaults).toEqual({
      'plugin:my-executor': {
        cache: false,
        inputs: ['default', '^production', '{workspaceRoot}/other-file.txt'],
        options: {
          watch: false,
        },
      },
    });
  });

  it('should not remove defaults if target uses other executors', async () => {
    let nxJson = readNxJson(tree);
    nxJson.targetDefaults['echo'] = {
      cache: false,
      inputs: ['default', '^production', '{workspaceRoot}/other-file.txt'],
      options: {
        watch: false,
      },
    };
    updateNxJson(tree, nxJson);

    addProjectConfiguration(tree, 'proj1', {
      root: 'proj1',
      targets: {
        echo: {
          executor: 'plugin:my-executor',
          options: {
            watch: true,
          },
        },
      },
    });
    addProjectConfiguration(tree, 'proj2', {
      root: 'proj2',
      targets: {
        echo: {
          executor: 'plugin:my-other-executor',
          options: {},
        },
      },
    });

    const targetNames = getExecutorTargets(projectGraph, 'plugin:my-executor');

    nxJson = updateNxJsonWithTargetDefaultsForExecutor(
      tree,
      nxJson,
      projectGraph,
      'plugin:my-executor',
      {
        cache: true,
        inputs: ['default'],
      },
      targetNames
    );

    expect(nxJson.targetDefaults).toEqual({
      'plugin:my-executor': {
        cache: false,
        inputs: ['default', '^production', '{workspaceRoot}/other-file.txt'],
        options: {
          watch: false,
        },
      },
      echo: {
        cache: false,
        inputs: ['default', '^production', '{workspaceRoot}/other-file.txt'],
        options: {
          watch: false,
        },
      },
    });
  });

  it("should't error if a project is present in the graph but not using project.json", async () => {
    projectGraph.nodes['csproj'] = {
      name: 'csproj',
      type: 'lib',
      data: {
        root: 'csproj',
        targets: {
          build: {
            command: 'echo HELLO',
          },
        },
      },
    };
    addProjectConfiguration(tree, 'proj1', {
      root: 'proj1',
      targets: {
        test: {
          executor: 'plugin:my-executor',
          options: {
            watch: true,
          },
        },
      },
    });
    let nxJson = {
      targetDefaults: {
        build: {
          inputs: ['default', '^production'],
        },
      },
    };
    updateNxJson(tree, nxJson);

    const targetNames = getExecutorTargets(projectGraph, 'plugin:my-executor');

    updateNxJsonWithTargetDefaultsForExecutor(
      tree,
      nxJson,
      projectGraph,
      'plugin:my-executor',
      {
        cache: true,
        inputs: ['default'],
      },
      targetNames
    );
  });
});
