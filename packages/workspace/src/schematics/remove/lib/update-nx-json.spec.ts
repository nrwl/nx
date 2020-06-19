import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runSchematic } from '../../../utils/testing';
import { Schema } from '../schema';
import { updateNxJson } from './update-nx-json';
import { updateJsonInTree } from '@nrwl/workspace/src/utils/ast-utils';

describe('updateNxJson Rule', () => {
  let tree: UnitTestTree;

  beforeEach(async () => {
    tree = new UnitTestTree(Tree.empty());
    tree = createEmptyWorkspace(tree) as UnitTestTree;
  });

  it('should update nx.json', async () => {
    tree = await runSchematic('lib', { name: 'my-lib1' }, tree);
    tree = await runSchematic('lib', { name: 'my-lib2' }, tree);

    let nxJson = readJsonInTree(tree, '/nx.json');
    expect(nxJson.projects['my-lib1']).toBeDefined();

    tree = (await callRule(
      updateJsonInTree('nx.json', (json) => {
        json.projects['my-lib2'].implicitDependencies = [
          'my-lib1',
          'my-other-lib',
        ];
        return json;
      }),
      tree
    )) as UnitTestTree;

    const schema: Schema = {
      projectName: 'my-lib1',
      skipFormat: false,
      forceRemove: false,
    };

    tree = (await callRule(updateNxJson(schema), tree)) as UnitTestTree;

    nxJson = readJsonInTree(tree, '/nx.json');
    expect(nxJson.projects['my-lib1']).toBeUndefined();
    expect(nxJson.projects['my-lib2'].implicitDependencies).toEqual([
      'my-other-lib',
    ]);
  });
});
