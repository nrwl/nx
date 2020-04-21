import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic } from '../../../utils/testing';
import { Schema } from '../schema';

describe('moveProject Rule', () => {
  let tree: UnitTestTree;
  let schema: Schema;

  beforeEach(async () => {
    tree = createEmptyWorkspace(Tree.empty()) as UnitTestTree;
    tree = await runSchematic('lib', { name: 'my-lib' }, tree);

    schema = {
      projectName: 'my-lib',
      skipFormat: false,
      forceRemove: false,
    };
  });

  it('should delete the project folder', async () => {
    // TODO - Currently this test will fail due to
    //        https://github.com/angular/angular-cli/issues/16527
    // tree = (await callRule(removeProject(schema), tree)) as UnitTestTree;
    //
    // const libDir = tree.getDir('libs/my-lib');
    // let filesFound = false;
    // libDir.visit(_file => {
    //   filesFound = true;
    // });
    // expect(filesFound).toBeFalsy();
  });
});
