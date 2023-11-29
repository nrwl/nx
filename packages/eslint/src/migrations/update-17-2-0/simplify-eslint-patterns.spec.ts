import { Tree, addProjectConfiguration, readJson } from '@nx/devkit';

import update from './simplify-eslint-patterns';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';

describe('simplify-eslint-patterns migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('.eslintrc.json', '{}');
  });

  it('should remove pattern if matches default', async () => {
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
    expect(projJson.targets.lint).toMatchInlineSnapshot(`
      {
        "executor": "@nx/eslint:lint",
      }
    `);
  });

  it('should not remove options if other fields are set', async () => {
    addProjectConfiguration(tree, 'test-lib', {
      root: 'libs/test-lib',
      projectType: 'library',
      targets: {
        lint: {
          executor: '@nx/eslint:lint',
          options: {
            lintFilePatterns: ['libs/test-lib/**/*.{ts,html}'],
            ignorePatterns: ['**/node_modules/**'],
          },
        },
      },
    });

    await update(tree);

    const projJson = readJson(tree, 'libs/test-lib/project.json');
    expect(projJson.targets.lint).toMatchInlineSnapshot(`
      {
        "executor": "@nx/eslint:lint",
        "options": {
          "ignorePatterns": [
            "**/node_modules/**",
          ],
        },
      }
    `);
  });

  it('should remove multiple lint patterns if matches default', async () => {
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
    expect(projJson.targets.lint).toMatchInlineSnapshot(`
      {
        "executor": "@nx/eslint:lint",
      }
    `);
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
