import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import * as path from 'path';

describe('update workspace that have web and angular lib builders', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(() => {
    initialTree = createEmptyWorkspace(Tree.empty());

    initialTree.overwrite(
      'workspace.json',
      JSON.stringify({
        version: 1,
        projects: {
          products: {
            root: 'apps/products',
            sourceRoot: 'apps/products/src',
            architect: {
              build: {
                builder: '@nrwl/angular:package',
              },
            },
          },
          cart: {
            root: 'apps/cart',
            sourceRoot: 'apps/cart/src',
            architect: {
              build: {
                builder: '@nrwl/web:package',
              },
            },
          },
          basket: {
            root: 'apps/basket',
            sourceRoot: 'apps/basket/src',
            architect: {
              build: {
                builder: '@nrwl/node:package',
              },
            },
          },
        },
      })
    );
    schematicRunner = new SchematicTestRunner(
      '@nrwl/workspace',
      path.join(__dirname, '../../../migrations.json')
    );
  });

  it('should add `buildableProjectDepsInPackageJsonType` to specific builders', async () => {
    const result = await schematicRunner
      .runSchematicAsync(
        'add-buildable-project-deps-in-package-json-type',
        {},
        initialTree
      )
      .toPromise();

    const workspace = JSON.parse(result.readContent('workspace.json'));

    expect(workspace.projects['products'].architect.build)
      .toMatchInlineSnapshot(`
      Object {
        "builder": "@nrwl/angular:package",
        "options": Object {
          "buildableProjectDepsInPackageJsonType": "dependencies",
        },
      }
    `);
    expect(workspace.projects['cart'].architect.build).toMatchInlineSnapshot(`
      Object {
        "builder": "@nrwl/web:package",
        "options": Object {
          "buildableProjectDepsInPackageJsonType": "dependencies",
        },
      }
    `);
    expect(workspace.projects['basket'].architect.build).toMatchInlineSnapshot(`
      Object {
        "builder": "@nrwl/node:package",
      }
    `);
  });
});
