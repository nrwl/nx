import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { readJsonInTree, updateJsonInTree } from '../ast-utils';
import { callRule } from '../testing';
import { setDefaultCollection } from './workspace';
import {
  _test_addWorkspaceFile,
  WorkspaceFormat,
} from '@angular-devkit/core/src/workspace/core';

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
    tree.create('nx.json', JSON.stringify({}));
  });

  describe('setDefaultCollection', () => {
    it('should be set if none was set before', async () => {
      const result = new UnitTestTree(
        await callRule(setDefaultCollection(defaultCollectionName), tree)
      );
      const nxJson = readJsonInTree(result, 'nx.json');

      expect(nxJson.cli.defaultCollection).toEqual(defaultCollectionName);
    });

    it(`should be set if ${nrwlWorkspaceName} was set before`, async () => {
      tree = new UnitTestTree(
        await callRule(
          updateJsonInTree('nx.json', (json) => {
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
      const nxJson = readJsonInTree(result, 'nx.json');
      expect(nxJson.cli.defaultCollection).toEqual(
        defaultCollectionName
      );
    });

    it('should not be set if something else was set before', async () => {
      const otherCollection = '@nrwl/angular';
      tree = new UnitTestTree(
        await callRule(
          updateJsonInTree('nx.json', (json) => {
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
      const nxJson = readJsonInTree(result, 'nx.json');
      expect(nxJson.cli.defaultCollection).toEqual(otherCollection);
    });
  });
});
