import {
  addProjectConfiguration,
  ProjectGraph,
  readJson,
  Tree,
} from '@nx/devkit';

import { Linter } from '../utils/linter';
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
      linter: Linter.EsLint,
      project: 'nestedpkg',
      setParserOptionsProject: false,
    });

    expect(readJson(tree, 'package.json')).toMatchObject({
      devDependencies: {
        '@nx/eslint-plugin': expect.any(String),
      },
    });
  });
});
