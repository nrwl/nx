import {
  addProjectConfiguration,
  ProjectGraph,
  readJson,
  Tree,
  updateNxJson,
} from '@nx/devkit';

import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { lintProjectGenerator } from './lint-project';

let projectGraph: ProjectGraph;

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => projectGraph),
}));

describe('@nx/eslint:lint-project (convert to monorepo style)', () => {
  let tree: Tree;

  const defaultOptions = {
    skipFormat: false,
    addPlugin: true,
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    const rootpkg = {
      root: '.',
      projectType: 'library' as const,
      targets: {
        'eslint:lint': {
          executor: 'nx:run-commands',
          options: {
            command: 'eslint .',
          },
        },
      },
    };
    projectGraph = {
      nodes: {
        rootpkg: {
          type: 'lib',
          name: 'rootpkg',
          data: rootpkg,
        },
      },
      dependencies: {},
    };
    addProjectConfiguration(tree, 'rootpkg', rootpkg);
    tree.write(
      '.eslintrc.cjs',
      `
      module.exports = {
      root: true,
      env: { browser: true, es2020: true },
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react-hooks/recommended',
      ],
      ignorePatterns: ['dist', '.eslintrc.cjs'],
      parser: '@typescript-eslint/parser',
    }
    `
    );
  });

  it('should generate a eslint config and configure the target in project configuration', async () => {
    addProjectConfiguration(tree, 'nestedpkg', {
      root: 'nestedpkg',
      projectType: 'library',
      targets: {},
    });

    await lintProjectGenerator(tree, {
      ...defaultOptions,
      linter: 'eslint',
      project: 'nestedpkg',
      setParserOptionsProject: false,
    });

    expect(readJson(tree, 'package.json')).toMatchObject({
      devDependencies: {
        '@nx/eslint-plugin': expect.any(String),
      },
    });
  });

  // Regression: the root lint target was just written to the tree earlier in
  // the same generator run. The project graph is stale and would not see it,
  // so relying on the graph alone deferred the split to a second invocation.
  it('should split the root eslint config when the root lint target is only on the tree', async () => {
    projectGraph = { nodes: {}, dependencies: {} };

    addProjectConfiguration(tree, 'nestedpkg', {
      root: 'nestedpkg',
      projectType: 'library',
      targets: {},
    });

    await lintProjectGenerator(tree, {
      ...defaultOptions,
      linter: 'eslint',
      project: 'nestedpkg',
      setParserOptionsProject: false,
    });

    expect(tree.exists('.eslintrc.base.json')).toBe(true);
  });

  // Regression for #23147: root lint target is only inferred by
  // `@nx/eslint/plugin`, so it is not on the tree. The graph surfaces it and
  // migration should still fire.
  it('should split the root eslint config for plugin-inferred root lint targets', async () => {
    tree = createTreeWithEmptyWorkspace();
    updateNxJson(tree, { plugins: ['@nx/eslint/plugin'] });
    tree.write('.eslintrc.cjs', 'module.exports = {};');
    addProjectConfiguration(tree, 'rootpkg', {
      root: '.',
      projectType: 'library',
      targets: {},
    });
    addProjectConfiguration(tree, 'nestedpkg', {
      root: 'nestedpkg',
      projectType: 'library',
      targets: {},
    });
    projectGraph = {
      nodes: {
        rootpkg: {
          type: 'lib',
          name: 'rootpkg',
          data: {
            root: '.',
            targets: {
              lint: {
                executor: 'nx:run-commands',
                options: { command: 'eslint .' },
              },
            },
          },
        },
      },
      dependencies: {},
    };

    await lintProjectGenerator(tree, {
      ...defaultOptions,
      linter: 'eslint',
      project: 'nestedpkg',
      setParserOptionsProject: false,
    });

    expect(tree.exists('.eslintrc.base.json')).toBe(true);
  });

  it('should not split the root eslint config when no root lint target exists', async () => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('.eslintrc.cjs', 'module.exports = {};');
    addProjectConfiguration(tree, 'rootpkg', {
      root: '.',
      projectType: 'library',
      targets: {},
    });
    addProjectConfiguration(tree, 'nestedpkg', {
      root: 'nestedpkg',
      projectType: 'library',
      targets: {},
    });
    projectGraph = { nodes: {}, dependencies: {} };

    await lintProjectGenerator(tree, {
      ...defaultOptions,
      linter: 'eslint',
      project: 'nestedpkg',
      setParserOptionsProject: false,
    });

    expect(tree.exists('.eslintrc.base.json')).toBe(false);
  });

  it('should not split the root eslint config when the base config already exists', async () => {
    tree.write('.eslintrc.base.json', '{}');
    addProjectConfiguration(tree, 'nestedpkg', {
      root: 'nestedpkg',
      projectType: 'library',
      targets: {},
    });

    await lintProjectGenerator(tree, {
      ...defaultOptions,
      linter: 'eslint',
      project: 'nestedpkg',
      setParserOptionsProject: false,
    });

    expect(readJson(tree, '.eslintrc.base.json')).toEqual({});
  });
});
