import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { readJsonInTree } from '@nrwl/workspace';
import * as path from 'path';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';

describe('Update Next to 11.1.0', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    schematicRunner = new SchematicTestRunner(
      '@nrwl/react',
      path.join(__dirname, '../../../migrations.json')
    );
  });

  it(`should update libs`, async () => {
    tree.overwrite(
      'package.json',
      JSON.stringify({
        dependencies: {},
        devDependencies: {
          next: '10.0.1',
        },
      })
    );

    tree = await schematicRunner
      .runSchematicAsync('update-12.7.1', {}, tree)
      .toPromise();

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      dependencies: {},
      devDependencies: {
        next: '11.1.0',
      },
    });
  });
});
