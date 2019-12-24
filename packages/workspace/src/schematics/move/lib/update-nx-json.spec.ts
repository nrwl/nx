import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runSchematic } from '../../../utils/testing';
import { Schema } from '../schema';
import { updateNxJson } from './update-nx-json';

describe('updateNxJson Rule', () => {
  let tree: UnitTestTree;

  beforeEach(async () => {
    tree = new UnitTestTree(Tree.empty());
    tree = createEmptyWorkspace(tree) as UnitTestTree;
  });

  it('should update nx.json', async () => {
    tree = await runSchematic('lib', { name: 'my-source' }, tree);

    const schema: Schema = {
      projectName: 'my-source',
      destination: 'my-destination'
    };

    tree = (await callRule(updateNxJson(schema), tree)) as UnitTestTree;

    const nxJson = readJsonInTree(tree, '/nx.json');

    expect(nxJson.projects['my-source']).toBeUndefined();
    expect(nxJson.projects['my-destination']).toEqual({
      tags: []
    });
  });
});
