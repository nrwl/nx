import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { readJsonInTree, updateJsonInTree } from '../ast-utils';
import { callRule } from '../testing';
import { setDefaultCollection } from './workspace';
import {
  _test_addWorkspaceFile,
  WorkspaceFormat,
} from '@angular-devkit/core/src/workspace/core';

/**
 * This test suite is ran with utils from @angular-devkit.
 * The rules are being tested as though they were used
 * in a non-nx angular workspace. This means changes from
 * ngcli-adapter or wrapAngularDevkitSchematic are not applied
 * to the rules during the unit tests, as they would not be applied
 * when being ran in a non-nx workspace.
 */
describe('Workspace', () => {
  const defaultCollectionName = '@nrwl/node';
  const workspaceJsonFileName = 'workspace.json';
  const nrwlWorkspaceName = '@nrwl/workspace';
  let tree: UnitTestTree;

  beforeEach(() => {
    _test_addWorkspaceFile('workspace.json', WorkspaceFormat.JSON);
    tree = new UnitTestTree(Tree.empty());
    tree.create(
      '/workspace.json',
      JSON.stringify({ version: 1, projects: {}, newProjectRoot: '' })
    );
  });

  describe('setDefaultCollection', () => {
    it('should be set if none was set before', async () => {
      const result = new UnitTestTree(
        await callRule(setDefaultCollection(defaultCollectionName), tree)
      );
      const workspaceJson = readJsonInTree(result, 'workspace.json');

      expect(workspaceJson.cli.defaultCollection).toEqual(
        defaultCollectionName
      );
    });

    it(`should be set if ${nrwlWorkspaceName} was set before`, async () => {
      tree = new UnitTestTree(
        await callRule(
          updateJsonInTree(workspaceJsonFileName, (json) => {
            json.cli = {
              defaultCollection: nrwlWorkspaceName,
            };

            return json;
          }),
          tree
        )
      );
      const result = new UnitTestTree(
        await callRule(setDefaultCollection(defaultCollectionName), tree)
      );
      const workspaceJson = readJsonInTree(result, workspaceJsonFileName);
      expect(workspaceJson.cli.defaultCollection).toEqual(
        defaultCollectionName
      );
    });

    it('should not be set if something else was set before', async () => {
      const otherCollection = '@nrwl/angular';
      tree = new UnitTestTree(
        await callRule(
          updateJsonInTree(workspaceJsonFileName, (json) => {
            json.cli = {
              defaultCollection: otherCollection,
            };

            json.schematics = {};

            return json;
          }),
          tree
        )
      );
      const result = new UnitTestTree(
        await callRule(setDefaultCollection(defaultCollectionName), tree)
      );
      const workspaceJson = readJsonInTree(result, workspaceJsonFileName);
      expect(workspaceJson.cli.defaultCollection).toEqual(otherCollection);
    });
  });
});
