import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';

import { Linter } from '../utils/linter';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { lintProjectGenerator } from './lint-project';

describe('@nrwl/linter:lint-project', () => {
  let tree: Tree;

  const defaultOptions = {
    skipFormat: false,
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
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
          setParserOptionsProject: false,
        });

        expect(
          tree.read('libs/test-lib/.eslintrc.json', 'utf-8')
        ).toMatchSnapshot();
      });

      it('should configure the target in project configuration', async () => {
        await lintProjectGenerator(tree, {
          ...defaultOptions,
          linter: Linter.EsLint,
          eslintFilePatterns: ['**/*.ts'],
          project: 'test-lib',
          setParserOptionsProject: false,
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
            "outputs": Array [
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
          eslintFilePatterns: ['**/*.ts'],
          project: 'test-lib',
          setParserOptionsProject: false,
        });

        expect(
          tree.read('libs/test-lib/.eslintrc.json', 'utf-8')
        ).toMatchSnapshot();
      });
    });
  });
});
