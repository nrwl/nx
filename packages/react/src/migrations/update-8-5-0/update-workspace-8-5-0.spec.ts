import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import {
  updateJsonInTree,
  readJsonInTree,
  updateWorkspaceInTree,
  readWorkspace,
  getWorkspacePath,
  writeJsonInTree,
} from '@nrwl/workspace';

import * as path from 'path';

describe('Update 8-5-0', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    tree = Tree.empty();
    schematicRunner = new SchematicTestRunner(
      '@nrwl/react',
      path.join(__dirname, '../../../migrations.json')
    );
  });

  it(`should remove babel schematic defaults`, async () => {
    writeJsonInTree(tree, 'workspace.json', {
      schematics: {
        '@nrwl/react': {
          application: {
            babel: true,
          },
        },
        '@nrwl/react:application': {
          babel: true,
        },
      },
    });

    tree = await schematicRunner
      .runSchematicAsync('update-workspace-8.5.0', {}, tree)
      .toPromise();

    const config = readWorkspace(tree);
    expect(config).toEqual({
      version: 1,
      schematics: {
        '@nrwl/react': {
          application: {},
        },
        '@nrwl/react:application': {},
      },
    });
  });
});
