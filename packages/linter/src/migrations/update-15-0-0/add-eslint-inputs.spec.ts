import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import {
  Tree,
  addProjectConfiguration,
  readWorkspaceConfiguration,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import addEslintInputs from './add-eslint-inputs';
import { eslintConfigFileWhitelist } from '../../generators/utils/eslint-file';

describe('15.0.0 migration (add-eslint-inputs)', () => {
  let tree: Tree;

  describe('production', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();

      updateWorkspaceConfiguration(tree, {
        version: 2,
        namedInputs: {
          default: ['{projectRoot}/**/*', 'sharedGlobals'],
          sharedGlobals: [],
          production: ['default'],
        },
      });

      addProjectConfiguration(tree, 'proj', {
        root: 'proj',
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {},
          },
          lint2: {
            executor: '@nrwl/linter:eslint',
            options: {},
          },
          notTest: {
            executor: 'nx:run-commands',
          },
        },
      });
    });

    test.each(eslintConfigFileWhitelist)(
      'should ignore %p for production',
      async (eslintConfigFilename) => {
        tree.write(eslintConfigFilename, '{}');

        await addEslintInputs(tree);

        const updated = readWorkspaceConfiguration(tree);

        expect(updated.namedInputs.production).toEqual([
          'default',
          `!{projectRoot}/${eslintConfigFilename}`,
        ]);
      }
    );

    test.each(eslintConfigFileWhitelist)(
      'should add %p to all lint targets',
      async (eslintConfigFilename) => {
        tree.write(eslintConfigFilename, '{}');

        await addEslintInputs(tree);

        const updated = readWorkspaceConfiguration(tree);
        const result = ['default', `{workspaceRoot}/${eslintConfigFilename}`];

        expect(updated.targetDefaults.lint.inputs).toEqual(result);
        expect(updated.targetDefaults.lint2.inputs).toEqual(result);
      }
    );
  });

  describe('development', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();

      addProjectConfiguration(tree, 'proj', {
        root: 'proj',
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {},
          },
          lint2: {
            executor: '@nrwl/linter:eslint',
            options: {},
          },
          notTest: {
            executor: 'nx:run-commands',
          },
        },
      });
    });

    test.each(eslintConfigFileWhitelist)(
      'should not add `!{projectRoot}/%s` if `workspaceConfiguration.namedInputs` is undefined',
      async (eslintConfigFilename) => {
        updateWorkspaceConfiguration(tree, {
          version: 2,
        });

        tree.write(eslintConfigFilename, '{}');

        await addEslintInputs(tree);

        const updated = readWorkspaceConfiguration(tree);

        expect(updated.namedInputs?.production).toBeUndefined();
      }
    );

    test.each(eslintConfigFileWhitelist)(
      'should not add `!{projectRoot}/%s` if `workspaceConfiguration.namedInputs.production` is undefined',
      async (eslintConfigFilename) => {
        updateWorkspaceConfiguration(tree, {
          version: 2,
          namedInputs: {},
        });

        tree.write(eslintConfigFilename, '{}');

        await addEslintInputs(tree);

        const updated = readWorkspaceConfiguration(tree);

        expect(updated.namedInputs?.production).toBeUndefined();
      }
    );
  });

  describe('lintTargetDefaults.input fallback values', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();

      addProjectConfiguration(tree, 'proj', {
        root: 'proj',
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {},
          },
          lint2: {
            executor: '@nrwl/linter:eslint',
            options: {},
          },
          notTest: {
            executor: 'nx:run-commands',
          },
        },
      });
    });

    test.each(eslintConfigFileWhitelist)(
      'should not override `targetDefaults.lint.inputs` with `%s` as there was a default target set in the workspace config',
      async (eslintConfigFilename) => {
        updateWorkspaceConfiguration(tree, {
          version: 2,
          targetDefaults: {
            lint: {
              inputs: ['{workspaceRoot}/.eslintrc.default'],
            },
          },
        });

        tree.write(eslintConfigFilename, '{}');

        await addEslintInputs(tree);

        const updated = readWorkspaceConfiguration(tree);

        expect(updated.targetDefaults.lint.inputs).toEqual([
          '{workspaceRoot}/.eslintrc.default',
        ]);
        expect(updated.targetDefaults.lint2.inputs).toEqual([
          'default',
          `{workspaceRoot}/${eslintConfigFilename}`,
        ]);
      }
    );

    it('should return `default` if there is no globalEslintFile', async () => {
      updateWorkspaceConfiguration(tree, {
        version: 2,
      });

      await addEslintInputs(tree);

      const updated = readWorkspaceConfiguration(tree);

      expect(updated.targetDefaults.lint.inputs).toEqual(['default']);
      expect(updated.targetDefaults.lint2.inputs).toEqual(['default']);
    });
  });
});
