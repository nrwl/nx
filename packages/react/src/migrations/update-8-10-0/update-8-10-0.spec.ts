import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { readJsonInTree } from '@nrwl/workspace';

import * as path from 'path';

describe('Update 8-10-0', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    tree = Tree.empty();
    schematicRunner = new SchematicTestRunner(
      '@nrwl/react',
      path.join(__dirname, '../../../migrations.json')
    );
  });

  it(`should update libs`, async () => {
    tree.create(
      'package.json',
      JSON.stringify({
        dependencies: {
          '@emotion/core': '10.0.23',
          '@emotion/styled': '10.0.23'
        },
        devDependencies: {
          '@types/react': '16.9.13'
        }
      })
    );

    tree = await schematicRunner
      .runSchematicAsync('update-8.10.0', {}, tree)
      .toPromise();

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      dependencies: {
        '@emotion/core': '10.0.27',
        '@emotion/styled': '10.0.27'
      },
      devDependencies: {
        '@types/react': '16.9.17'
      }
    });
  });
});
