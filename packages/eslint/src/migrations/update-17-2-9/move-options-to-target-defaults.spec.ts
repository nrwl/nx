import {
  ProjectGraph,
  Tree,
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { createTree } from '@nx/devkit/testing';

import update from './move-options-to-target-defaults';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));

describe('change-target-defaults-to-executor migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
    tree.write('.eslintrc.json', '{}');

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

  it('should set targetDefaults with inputs', async () => {
    addProjectConfigAndUpdateGraph(tree, 'test-lib1', {
      root: 'test-lib1',
      projectType: 'library',
      targets: {
        lint: {
          executor: '@nx/eslint:lint',
          options: {
            lintFilePatterns: ['test-lib1/**/*.{ts,html}'],
          },
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'test-lib1').targets.lint).toEqual({
      executor: '@nx/eslint:lint',
      options: {
        lintFilePatterns: ['{projectRoot}/**/*.{ts,html}'],
      },
    });

    expect(readNxJson(tree).targetDefaults).toEqual({
      '@nx/eslint:lint': {
        cache: true,
        inputs: [
          'default',
          '{workspaceRoot}/.eslintrc.json',
          '{workspaceRoot}/tools/eslint-rules/**/*',
        ],
      },
    });
  });

  it('should remove obsolete eslint config', async () => {
    addProjectConfigAndUpdateGraph(tree, 'test-lib1', {
      root: 'test-lib1',
      projectType: 'library',
      targets: {
        lint: {
          executor: '@nx/eslint:lint',
          options: {
            lintFilePatterns: ['test-lib1/**/*.{ts,html}'],
            eslintConfig: 'test-lib1/.eslintrc.json',
          },
        },
      },
    });
    tree.write('test-lib1/.eslintrc.json', '{}');

    await update(tree);

    expect(readProjectConfiguration(tree, 'test-lib1').targets.lint).toEqual({
      executor: '@nx/eslint:lint',
      options: {
        lintFilePatterns: ['{projectRoot}/**/*.{ts,html}'],
      },
    });
  });

  it('should remove outputs if not used', async () => {
    addProjectConfigAndUpdateGraph(tree, 'test-lib1', {
      root: 'test-lib1',
      projectType: 'library',
      targets: {
        lint: {
          executor: '@nx/eslint:lint',
          options: {
            lintFilePatterns: ['test-lib1/**/*.{ts,html}'],
          },
          outputs: ['{options.outputFile}'],
        },
      },
    });

    await update(tree);

    expect(
      readProjectConfiguration(tree, 'test-lib1').targets.lint.outputs
    ).toBeUndefined();

    expect(
      readNxJson(tree).targetDefaults['@nx/eslint:lint'].outputs
    ).toBeUndefined();
  });

  it('should add outputs if used', async () => {
    addProjectConfigAndUpdateGraph(tree, 'test-lib1', {
      root: 'test-lib1',
      projectType: 'library',
      targets: {
        lint: {
          executor: '@nx/eslint:lint',
          options: {
            lintFilePatterns: ['test-lib1/**/*.{ts,html}'],
          },
          outputs: ['{options.outputFile}'],
        },
      },
    });
    addProjectConfigAndUpdateGraph(tree, 'test-lib2', {
      root: 'test-lib2',
      projectType: 'library',
      targets: {
        lint: {
          executor: '@nx/eslint:lint',
          options: {
            lintFilePatterns: ['test-lib2/**/*.{ts,html}'],
            outputFile: 'test-lib2/output.txt',
          },
          outputs: ['{options.outputFile}'],
        },
      },
    });

    await update(tree);

    expect(
      readProjectConfiguration(tree, 'test-lib1').targets.lint.outputs
    ).toBeUndefined();
    expect(
      readProjectConfiguration(tree, 'test-lib1').targets.lint.outputs
    ).toBeUndefined();

    expect(readNxJson(tree).targetDefaults['@nx/eslint:lint'].outputs).toEqual([
      '{options.outputFile}',
    ]);
  });

  it('should remove lint patterns if default', async () => {
    addProjectConfigAndUpdateGraph(tree, 'test-lib1', {
      root: 'test-lib1',
      projectType: 'library',
      targets: {
        lint: {
          executor: '@nx/eslint:lint',
          options: {
            lintFilePatterns: ['test-lib1'],
          },
        },
      },
    });
    addProjectConfigAndUpdateGraph(tree, 'test-lib2', {
      root: 'test-lib2',
      projectType: 'library',
      targets: {
        lint: {
          executor: '@nx/eslint:lint',
          options: {
            lintFilePatterns: ['{projectRoot}'],
          },
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'test-lib1').targets.lint).toEqual({
      executor: '@nx/eslint:lint',
    });
    expect(readProjectConfiguration(tree, 'test-lib2').targets.lint).toEqual({
      executor: '@nx/eslint:lint',
    });
  });

  it('should remove inputs if matching default', async () => {
    addProjectConfigAndUpdateGraph(tree, 'test-lib1', {
      root: 'test-lib1',
      projectType: 'library',
      targets: {
        lint: {
          executor: '@nx/eslint:lint',
          options: {
            lintFilePatterns: ['test-lib1/**/*.{ts,html}'],
          },
          inputs: ['default', '{workspaceRoot}/.eslintrc.json'],
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'test-lib1').targets.lint).toEqual({
      executor: '@nx/eslint:lint',
      options: {
        lintFilePatterns: ['{projectRoot}/**/*.{ts,html}'],
      },
    });
  });
});

function addProjectConfigAndUpdateGraph(tree, name, project) {
  addProjectConfiguration(tree, name, project);
  projectGraph.nodes[name] = {
    name: name,
    type: 'lib',
    data: {
      root: project.root,
      targets: project.targets,
    },
  };
}
