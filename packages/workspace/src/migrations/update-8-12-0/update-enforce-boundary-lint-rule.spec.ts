import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree } from '../../utils/ast-utils';
import { runMigration } from '../../utils/testing';
import {
  _test_addWorkspaceFile,
  WorkspaceFormat,
} from '@angular-devkit/core/src/workspace/core';
import type { NxJsonConfiguration } from '@nrwl/devkit';

describe('Add update-enforce-boundary-lint rule', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = Tree.empty();

    // Not invoking the createEmptyWorkspace(..) here as I want to
    // customize the linter being used
    _test_addWorkspaceFile('workspace.json', WorkspaceFormat.JSON);

    tree.create(
      '/workspace.json',
      JSON.stringify({ version: 1, projects: {}, newProjectRoot: '' })
    );
    tree.create(
      '/package.json',
      JSON.stringify({
        name: 'test-name',
        dependencies: {},
        devDependencies: {},
      })
    );
    tree.create(
      '/nx.json',
      JSON.stringify(<NxJsonConfiguration>{ npmScope: 'proj' })
    );
    tree.create(
      '/tsconfig.json',
      JSON.stringify({ compilerOptions: { paths: {} } })
    );
  });

  describe('when using tslint', () => {
    beforeEach(() => {
      tree.create(
        '/tslint.json',
        JSON.stringify({
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
        })
      );
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
      tree.create(
        '/.eslintrc',
        JSON.stringify({
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
        })
      );
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
