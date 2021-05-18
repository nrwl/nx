import { Tree } from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { angularMoveGenerator } from './move';

const libSchematic = wrapAngularDevkitSchematic('@nrwl/angular', 'lib');

describe('@nrwl/angular:move', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    await libSchematic(tree, {
      name: 'mylib',
    });
  });

  it('should move a project', async () => {
    await angularMoveGenerator(tree, {
      projectName: 'mylib',
      destination: 'mynewlib',
      updateImportPath: true,
    });

    expect(tree.exists('libs/mynewlib/src/lib/mynewlib.module.ts')).toEqual(
      true
    );
  });
});
