import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runSchematic } from '../../../utils/testing';
import { Schema } from '../schema';
import { updateTsconfig } from './update-tsconfig';

describe('updateTsconfig Rule', () => {
  let tree: UnitTestTree;
  let schema: Schema;

  beforeEach(async () => {
    tree = new UnitTestTree(Tree.empty());
    tree = createEmptyWorkspace(tree) as UnitTestTree;

    schema = {
      projectName: 'my-lib',
      skipFormat: false,
      forceRemove: false,
    };
  });

  it('should delete project ref from the tsconfig', async () => {
    tree = await runSchematic('lib', { name: 'my-lib' }, tree);

    let tsConfig = readJsonInTree(tree, '/tsconfig.base.json');
    expect(tsConfig.compilerOptions.paths).toEqual({
      '@proj/my-lib': ['libs/my-lib/src/index.ts'],
    });

    tree = (await callRule(updateTsconfig(schema), tree)) as UnitTestTree;

    tsConfig = readJsonInTree(tree, '/tsconfig.base.json');
    expect(tsConfig.compilerOptions.paths).toEqual({});
  });
});
