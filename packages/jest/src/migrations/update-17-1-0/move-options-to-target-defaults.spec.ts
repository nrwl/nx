import { createTree } from '@nx/devkit/testing';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));

import {
  addProjectConfiguration as _addProjectConfiguration,
  ProjectGraph,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateNxJson,
  writeJson,
} from '@nx/devkit';

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

import update from './move-options-to-target-defaults';

describe('move-options-to-target-defaults migration', () => {
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

  it('should add config to nx.json and remove it from projects', async () => {
    addProjectConfiguration(tree, 'proj1', {
      root: 'proj1',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'jest.config.js',
            passWithNoTests: true,
          },
          configurations: {
            ci: {
              ci: true,
              codeCoverage: true,
            },
          },
        },
      },
    });
    addProjectConfiguration(tree, 'proj2', {
      root: 'proj2',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'jest.config.js',
            passWithNoTests: true,
          },
          configurations: {
            ci: {
              ci: true,
              codeCoverage: true,
            },
          },
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'proj1').targets.test).toEqual({
      executor: '@nx/jest:jest',
      options: {
        jestConfig: 'jest.config.js',
      },
    });
    expect(readProjectConfiguration(tree, 'proj2').targets.test).toEqual({
      executor: '@nx/jest:jest',
      options: {
        jestConfig: 'jest.config.js',
      },
    });

    expect(readNxJson(tree).targetDefaults).toEqual({
      '@nx/jest:jest': {
        cache: true,
        configurations: {
          ci: {
            ci: true,
            codeCoverage: true,
          },
        },
        inputs: ['default', '^production'],
        options: {
          passWithNoTests: true,
        },
      },
    });
  });

  it('should use test target defaults if all jest targets are test', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults['test'] = {
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
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'jest.config.js',
            passWithNoTests: true,
          },
          configurations: {
            ci: {
              ci: true,
              codeCoverage: true,
            },
          },
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'proj1').targets.test).toEqual({
      executor: '@nx/jest:jest',
      options: {
        jestConfig: 'jest.config.js',
      },
    });

    expect(readNxJson(tree).targetDefaults).toEqual({
      '@nx/jest:jest': {
        cache: false,
        configurations: {
          ci: {
            ci: true,
            codeCoverage: true,
          },
        },
        inputs: ['default', '^production', '{workspaceRoot}/other-file.txt'],
        options: {
          passWithNoTests: true,
          watch: false,
        },
      },
    });
  });

  it('should not remove config which does not match', async () => {
    addProjectConfiguration(tree, 'proj1', {
      root: 'proj1',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          inputs: ['default', '^production', '{workspaceRoot}/other-file.txt'],
          options: {
            jestConfig: 'jest.config.js',
            passWithNoTests: true,
            watch: false,
          },
          configurations: {
            ci: {
              ci: true,
              codeCoverage: true,
            },
          },
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'proj1').targets.test).toEqual({
      executor: '@nx/jest:jest',
      inputs: ['default', '^production', '{workspaceRoot}/other-file.txt'],
      options: {
        jestConfig: 'jest.config.js',
        watch: false,
      },
    });

    expect(readNxJson(tree).targetDefaults).toEqual({
      '@nx/jest:jest': {
        cache: true,
        configurations: {
          ci: {
            ci: true,
            codeCoverage: true,
          },
        },
        inputs: ['default', '^production'],
        options: {
          passWithNoTests: true,
        },
      },
    });
  });

  it('should not remove defaults if target uses other executors', async () => {
    addProjectConfiguration(tree, 'proj1', {
      root: 'proj1',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'jest.config.js',
            passWithNoTests: true,
          },
          configurations: {
            ci: {
              ci: true,
              codeCoverage: true,
            },
          },
        },
      },
    });
    addProjectConfiguration(tree, 'proj2', {
      root: 'proj2',
      targets: {
        test: {
          executor: '@nx/vite:vitest',
          options: {},
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'proj1').targets.test).toEqual({
      executor: '@nx/jest:jest',
      options: {
        jestConfig: 'jest.config.js',
      },
    });
    expect(readProjectConfiguration(tree, 'proj2').targets.test).toEqual({
      executor: '@nx/vite:vitest',
      options: {},
    });

    expect(readNxJson(tree).targetDefaults).toEqual({
      '@nx/jest:jest': {
        cache: true,
        configurations: {
          ci: {
            ci: true,
            codeCoverage: true,
          },
        },
        inputs: ['default', '^production'],
        options: {
          passWithNoTests: true,
        },
      },
    });
  });

  it('should handle when jest and vite are used for test and jest and cypress are used for e2e', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults['test'] = {
      cache: false,
      inputs: ['default', '^production', '{workspaceRoot}/other-file.txt'],
      options: {
        watch: true,
      },
    };
    nxJson.targetDefaults['e2e'] = {
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
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'jest.config.ts',
            passWithNoTests: true,
          },
        },
        e2e: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'jest.config.ts',
            passWithNoTests: true,
          },
        },
      },
    });
    addProjectConfiguration(tree, 'proj2', {
      root: 'proj2',
      targets: {
        test: {
          executor: '@nx/vite:vitest',
          options: {},
        },
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {},
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'proj1').targets).toEqual({
      e2e: {
        executor: '@nx/jest:jest',
        options: {
          jestConfig: 'jest.config.ts',
        },
      },
      test: {
        executor: '@nx/jest:jest',
        options: {
          jestConfig: 'jest.config.ts',
        },
      },
    });

    expect(readProjectConfiguration(tree, 'proj2').targets).toEqual({
      e2e: {
        executor: '@nx/cypress:cypress',
        options: {},
      },
      test: {
        executor: '@nx/vite:vitest',
        options: {},
      },
    });

    expect(readNxJson(tree).targetDefaults).toEqual({
      '@nx/jest:jest': {
        cache: true,
        configurations: {
          ci: {
            ci: true,
            codeCoverage: true,
          },
        },
        inputs: ['default', '^production'],
        options: {
          passWithNoTests: true,
        },
      },
      e2e: {
        cache: false,
        inputs: ['default', '^production', '{workspaceRoot}/other-file.txt'],
        options: {
          watch: false,
        },
      },
      test: {
        cache: false,
        inputs: ['default', '^production', '{workspaceRoot}/other-file.txt'],
        options: {
          watch: true,
        },
      },
    });
  });

  it('should not assign things that had a default already', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults['test'] = {
      cache: true,
      inputs: ['default', '^production'],
      options: {
        passWithNoTests: true,
      },
    };
    updateNxJson(tree, nxJson);

    addProjectConfiguration(tree, 'proj1', {
      root: 'proj1',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'jest.config.ts',
          },
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'proj1').targets).toEqual({
      test: {
        executor: '@nx/jest:jest',
        options: {
          jestConfig: 'jest.config.ts',
        },
      },
    });

    expect(readNxJson(tree).targetDefaults).toEqual({
      '@nx/jest:jest': {
        cache: true,
        configurations: {
          ci: {
            ci: true,
            codeCoverage: true,
          },
        },
        inputs: ['default', '^production'],
        options: {
          passWithNoTests: true,
        },
      },
    });
  });

  it('should remove target defaults which are not used anymore', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults['@nx/vite:test'] = {
      cache: false,
      inputs: ['default', '^production'],
    };
    nxJson.targetDefaults['test'] = {
      cache: false,
      inputs: ['default', '^production', '{workspaceRoot}/other-file.txt'],
      options: {
        watch: true,
      },
    };
    nxJson.targetDefaults['e2e'] = {
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
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'jest.config.ts',
            passWithNoTests: true,
          },
        },
        e2e: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'jest.config.ts',
            passWithNoTests: true,
          },
        },
      },
    });
    addProjectConfiguration(tree, 'proj2', {
      root: 'proj2',
      targets: {
        test: {
          executor: '@nx/vite:test',
          options: {},
        },
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {},
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'proj1').targets).toEqual({
      e2e: {
        executor: '@nx/jest:jest',
        options: {
          jestConfig: 'jest.config.ts',
        },
      },
      test: {
        executor: '@nx/jest:jest',
        options: {
          jestConfig: 'jest.config.ts',
        },
      },
    });

    expect(readProjectConfiguration(tree, 'proj2').targets).toEqual({
      e2e: {
        executor: '@nx/cypress:cypress',
        options: {},
      },
      test: {
        executor: '@nx/vite:test',
        options: {},
      },
    });

    expect(readNxJson(tree).targetDefaults).toEqual({
      '@nx/jest:jest': {
        cache: true,
        configurations: {
          ci: {
            ci: true,
            codeCoverage: true,
          },
        },
        inputs: ['default', '^production'],
        options: {
          passWithNoTests: true,
        },
      },
      '@nx/vite:test': {
        cache: false,
        inputs: ['default', '^production'],
      },
      e2e: {
        cache: false,
        inputs: ['default', '^production', '{workspaceRoot}/other-file.txt'],
        options: {
          watch: false,
        },
      },
    });
  });
});
