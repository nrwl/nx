import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree, writeJsonInTree } from '../../utils/ast-utils';
import { runMigration } from '../../utils/testing';
import {
  _test_addWorkspaceFile,
  WorkspaceFormat,
} from '@angular-devkit/core/src/workspace/core';
import { NxJson } from '../../core/shared-interfaces';

describe('Add update-enforce-boundary-lint rule', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = Tree.empty();

    // Not invoking the createEmptyWorkspace(..) here as I want to
    // customize the linter being used
    _test_addWorkspaceFile('workspace.json', WorkspaceFormat.JSON);

    writeJsonInTree(tree, '/workspace.json', {
      version: 1,
      projects: {},
      newProjectRoot: '',
    });
    writeJsonInTree(tree, '/package.json', {
      name: 'test-name',
      dependencies: {},
      devDependencies: {},
    });
    writeJsonInTree(tree, '/nx.json', <NxJson>{
      npmScope: 'proj',
      projects: {},
    });
    writeJsonInTree(tree, '/tsconfig.json', { compilerOptions: { paths: {} } });
  });

  describe('when using tslint', () => {
    beforeEach(() => {
      writeJsonInTree(tree, '/tslint.json', {
        rules: {
          'nx-enforce-module-boundaries': [
            true,
            {
              npmScope: '<%= npmScope %>',
              lazyLoad: [],
              allow: [],
            },
          ],
        },
      });
    });

    it('should add the proper enforceBuildableLibDependency flag', async () => {
      const result = await runMigration(
        'update-enforce-boundary-lint-rule',
        {},
        tree
      );

      const lintContent = readJsonInTree(result, 'tslint.json');
      expect(
        lintContent.rules['nx-enforce-module-boundaries'][1]
          .enforceBuildableLibDependency
      ).toBeTruthy();
    });
  });

  describe('when using eslint', () => {
    beforeEach(() => {
      writeJsonInTree(tree, '/.eslintrc', {
        rules: {
          '@nrwl/nx/enforce-module-boundaries': [
            true,
            {
              npmScope: '<%= npmScope %>',
              lazyLoad: [],
              allow: [],
            },
          ],
        },
      });
    });

    it('should add the proper enforceBuildableLibDependency flag', async () => {
      const result = await runMigration(
        'update-enforce-boundary-lint-rule',
        {},
        tree
      );

      const lintContent = readJsonInTree(result, '.eslintrc');
      expect(
        lintContent.rules['@nrwl/nx/enforce-module-boundaries'][1]
          .enforceBuildableLibDependency
      ).toBeTruthy();
    });
  });
});
