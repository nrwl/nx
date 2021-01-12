import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { Linter } from '../utils/linter';
import { lintProjectGenerator } from './lint-project';

describe('@nrwl/linter:lint-project', () => {
  let tree: Tree;

  const defaultOptions = {
    skipFormat: false,
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'test-lib', {
      root: 'libs/test-lib',
      targets: {},
    });
  });

  describe('--linter', () => {
    describe('eslint', () => {
      it('should generate a eslint config', async () => {
        await lintProjectGenerator(tree, {
          ...defaultOptions,
          linter: Linter.EsLint,
          eslintFilePatterns: ['**/*.ts'],
          project: 'test-lib',
        });

        expect(
          tree.read('libs/test-lib/.eslintrc.json').toString()
        ).toMatchSnapshot();
      });

      it('should configure the target in workspace.json', async () => {
        await lintProjectGenerator(tree, {
          ...defaultOptions,
          linter: Linter.EsLint,
          eslintFilePatterns: ['**/*.ts'],
          project: 'test-lib',
        });

        const projectConfig = readProjectConfiguration(tree, 'test-lib');
        expect(projectConfig.targets.lint).toMatchInlineSnapshot(`
          Object {
            "executor": "@nrwl/linter:eslint",
            "options": Object {
              "lintFilePatterns": Array [
                "**/*.ts",
              ],
            },
          }
        `);
      });
    });

    describe('tslint', () => {
      it('should generate a tslint config', async () => {
        await lintProjectGenerator(tree, {
          ...defaultOptions,
          linter: Linter.TsLint,
          tsConfigPaths: ['tsconfig.json'],
          project: 'test-lib',
        });

        expect(
          tree.read('libs/test-lib/tslint.json').toString()
        ).toMatchSnapshot();
      });

      it('should configure the target in workspace.json', async () => {
        await lintProjectGenerator(tree, {
          ...defaultOptions,
          linter: Linter.TsLint,
          tsConfigPaths: ['tsconfig.json'],
          project: 'test-lib',
        });

        const projectConfig = readProjectConfiguration(tree, 'test-lib');
        expect(projectConfig.targets.lint).toMatchInlineSnapshot(`
          Object {
            "executor": "@angular-devkit/build-angular:tslint",
            "options": Object {
              "exclude": Array [
                "**/node_modules/**",
                "!libs/test-lib/**/*",
              ],
              "tsConfig": Array [
                "tsconfig.json",
              ],
            },
          }
        `);
      });
    });
  });
});
