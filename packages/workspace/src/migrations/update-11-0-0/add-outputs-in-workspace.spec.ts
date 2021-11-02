import { Tree } from '@angular-devkit/schematics';
import { readWorkspace } from '@nrwl/workspace';
import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import { join } from 'path';

describe('add `outputs` in workspace', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    tree = new UnitTestTree(Tree.empty());

    schematicRunner = new SchematicTestRunner(
      '@nrwl/workspace',
      join(__dirname, '../../../migrations.json')
    );
  });

  it('based on the builder', async () => {
    tree.create(
      'workspace.json',
      JSON.stringify({
        projects: {
          products: {
            root: 'apps/products',
            architect: {
              build: {
                builder: '@nrwl/jest:jest',
              },
              serve: {
                builder: 'whatever',
              },
            },
          },
          cart: {
            architect: {
              build: {
                builder: '@nrwl/web:build',
              },
              buildWithOutputsDefined: {
                builder: '@nrwl/web:build',
                outputs: ['test/dir'],
              },
            },
          },
          noArchitect: {
            projectType: 'library',
          },
        },
      })
    );

    await schematicRunner
      .runSchematicAsync('add-outputs-in-workspace', {}, tree)
      .toPromise();

    const config = readWorkspace(tree);
    const { products, cart, noArchitect } = config.projects;
    expect(products.architect.build.outputs).toEqual([
      'coverage/apps/products',
    ]);
    expect(products.architect.serve.outputs).toBeUndefined();

    expect(cart.architect.build.outputs).toEqual(['{options.outputPath}']);
    expect(cart.architect.buildWithOutputsDefined.outputs).toEqual([
      'test/dir',
    ]);

    expect(noArchitect).toEqual({
      projectType: 'library',
    });
  });
});
