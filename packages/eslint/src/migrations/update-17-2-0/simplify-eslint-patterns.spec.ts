import { Tree, addProjectConfiguration, readJson } from '@nx/devkit';

import update from './simplify-eslint-patterns';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';

describe('simplify-eslint-patterns migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('.eslintrc.json', '{}');
  });

  it('should update nested projects lint patterns', async () => {
    addProjectConfiguration(tree, 'test-lib', {
      root: 'libs/test-lib',
      projectType: 'library',
      targets: {
        lint: {
          executor: '@nx/eslint:lint',
          options: {
            lintFilePatterns: ['libs/test-lib/**/*.{ts,html}'],
          },
        },
      },
    });

    await update(tree);

    const projJson = readJson(tree, 'libs/test-lib/project.json');
    expect(projJson.targets.lint.options.lintFilePatterns).toEqual([
      'libs/test-lib',
    ]);
  });

  it('should join multiple lint patterns', async () => {
    addProjectConfiguration(tree, 'test-lib', {
      root: 'libs/test-lib',
      projectType: 'library',
      targets: {
        lint: {
          executor: '@nx/eslint:lint',
          options: {
            lintFilePatterns: [
              'libs/test-lib/**/*.ts',
              'libs/test-lib/**/*.html',
              'libs/test-lib/**/*.tsx',
            ],
          },
        },
      },
    });

    await update(tree);

    const projJson = readJson(tree, 'libs/test-lib/project.json');
    expect(projJson.targets.lint.options.lintFilePatterns).toEqual([
      'libs/test-lib',
    ]);
  });

  it('should persist external patterns', async () => {
    addProjectConfiguration(tree, 'test-lib', {
      root: 'libs/test-lib',
      projectType: 'library',
      targets: {
        lint: {
          executor: '@nx/eslint:lint',
          options: {
            lintFilePatterns: [
              'libs/test-lib/**/*.ts',
              'libs/some-external/**/*.html',
              'libs/test-lib/**/*.tsx',
              '**/*.js',
            ],
          },
        },
      },
    });

    await update(tree);

    const projJson = readJson(tree, 'libs/test-lib/project.json');
    expect(projJson.targets.lint.options.lintFilePatterns).toEqual([
      'libs/test-lib',
      'libs/some-external/**/*.html',
      '**/*.js',
    ]);
  });

  it('should update standalone projects lint patterns', async () => {
    addProjectConfiguration(tree, 'test-lib', {
      root: '',
      sourceRoot: './src',
      projectType: 'library',
      targets: {
        lint: {
          executor: '@nx/eslint:lint',
          options: {
            lintFilePatterns: ['./src/**/*.{ts,html}'],
          },
        },
      },
    });

    await update(tree);

    const projJson = readJson(tree, 'project.json');
    expect(projJson.targets.lint.options.lintFilePatterns).toEqual(['./src']);
  });
});
