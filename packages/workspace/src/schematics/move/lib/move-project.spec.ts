import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic } from '../../../utils/testing';
import { Schema } from '../schema';

describe('moveProject Rule', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createEmptyWorkspace(Tree.empty());
    tree = await runSchematic('lib', { name: 'my-lib' }, tree);
  });

  it('should copy all files and delete the source folder', async () => {
    const schema: Schema = {
      projectName: 'my-lib',
      destination: 'my-destination'
    };

    // TODO - Currently this test will fail due to
    //        https://github.com/angular/angular-cli/issues/16527
    // host = await callRule(moveProject(schema), host);

    // const destinationDir = host.getDir('libs/my-destination');
    // let filesFound = false;
    // destinationDir.visit(_file => {
    //   filesFound = true;
    // });
    // expect(filesFound).toBeTruthy();

    // const sourceDir = host.getDir('libs/my-lib');
    // filesFound = false;
    // sourceDir.visit(_file => {
    //   filesFound = true;
    // });
    // expect(filesFound).toBeFalsy();
  });
});
