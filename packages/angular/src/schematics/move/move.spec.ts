import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';

import { runSchematic } from '../../utils/testing';

import { Schema } from './schema';

describe('@nrwl/angular:move', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createEmptyWorkspace(Tree.empty());

    tree = await runSchematic(
      'library',
      {
        name: 'mylib',
      },
      tree
    );
  });

  it('should move a project', async () => {
    const result = await runSchematic<Schema>(
      'move',
      {
        projectName: 'mylib',
        destination: 'mynewlib',
        updateImportPath: true,
      },
      tree
    );

    expect(result.exists('libs/mynewlib/src/lib/mynewlib.module.ts')).toEqual(
      true
    );
  });
});
