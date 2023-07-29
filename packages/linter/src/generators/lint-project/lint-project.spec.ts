import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';

import { Linter } from '../utils/linter';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { lintProjectGenerator } from './lint-project';

describe('@nx/linter:lint-project', () => {
  let tree: Tree;

  const defaultOptions = {
    skipFormat: false,
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'test-lib', {
      root: 'libs/test-lib',
      projectType: 'library',
      targets: {
        test: {
          command: 'echo test',
        },
      },
    });
    addProjectConfiguration(tree, 'buildable-lib', {
      root: 'libs/buildable-lib',
      projectType: 'library',
      targets: {
        build: {
          command: 'echo build',
        },
      },
    });
  });

  it('should generate a eslint config and configure the target in project configuration', async () => {
    await lintProjectGenerator(tree, {
      ...defaultOptions,
      linter: Linter.EsLint,
      eslintFilePatterns: ['libs/test-lib/**/*.ts'],
      project: 'test-lib',
      setParserOptionsProject: false,
    });

    expect(tree.read('libs/test-lib/.eslintrc.json', 'utf-8'))
      .toMatchInlineSnapshot(`
      "{
        "extends": ["../../.eslintrc.json"],
        "ignorePatterns": ["!**/*"],
        "overrides": [
          {
            "files": ["*.ts", "*.tsx", "*.js", "*.jsx"],
            "rules": {}
          },
          {
            "files": ["*.ts", "*.tsx"],
            "rules": {}
          },
          {
            "files": ["*.js", "*.jsx"],
            "rules": {}
          }
        ]
      }
      "
    `);

    const projectConfig = readProjectConfiguration(tree, 'test-lib');
    expect(projectConfig.targets.lint).toMatchInlineSnapshot(`
      {
        "executor": "@nx/linter:eslint",
        "options": {
          "lintFilePatterns": [
            "libs/test-lib/**/*.ts",
          ],
        },
        "outputs": [
          "{options.outputFile}",
        ],
      }
    `);
  });

  it('should generate a eslint config and configure the target for buildable library', async () => {
    await lintProjectGenerator(tree, {
      ...defaultOptions,
      linter: Linter.EsLint,
      eslintFilePatterns: ['libs/buildable-lib/**/*.ts'],
      project: 'buildable-lib',
      setParserOptionsProject: false,
    });

    expect(tree.read('libs/buildable-lib/.eslintrc.json', 'utf-8'))
      .toMatchInlineSnapshot(`
      "{
        "extends": ["../../.eslintrc.json"],
        "ignorePatterns": ["!**/*"],
        "overrides": [
          {
            "files": ["*.ts", "*.tsx", "*.js", "*.jsx"],
            "rules": {}
          },
          {
            "files": ["*.ts", "*.tsx"],
            "rules": {}
          },
          {
            "files": ["*.js", "*.jsx"],
            "rules": {}
          },
          {
            "files": ["*.json"],
            "parser": "jsonc-eslint-parser",
            "rules": {
              "@nx/dependency-checks": "error"
            }
          }
        ]
      }
      "
    `);

    const projectConfig = readProjectConfiguration(tree, 'buildable-lib');
    expect(projectConfig.targets.lint).toMatchInlineSnapshot(`
      {
        "executor": "@nx/linter:eslint",
        "options": {
          "lintFilePatterns": [
            "libs/buildable-lib/**/*.ts",
            "libs/buildable-lib/package.json",
          ],
        },
        "outputs": [
          "{options.outputFile}",
        ],
      }
    `);
  });

  it('should extend to .eslintrc.js when an .eslintrc.js already exist', async () => {
    tree.write('.eslintrc.js', '{}');

    await lintProjectGenerator(tree, {
      ...defaultOptions,
      linter: Linter.EsLint,
      eslintFilePatterns: ['libs/test-lib/**/*.ts'],
      project: 'test-lib',
      setParserOptionsProject: false,
    });

    expect(tree.read('libs/test-lib/.eslintrc.json', 'utf-8'))
      .toMatchInlineSnapshot(`
      "{
        "extends": ["../../.eslintrc.js"],
        "ignorePatterns": ["!**/*"],
        "overrides": [
          {
            "files": ["*.ts", "*.tsx", "*.js", "*.jsx"],
            "rules": {}
          },
          {
            "files": ["*.ts", "*.tsx"],
            "rules": {}
          },
          {
            "files": ["*.js", "*.jsx"],
            "rules": {}
          }
        ]
      }
      "
    `);
  });
});
