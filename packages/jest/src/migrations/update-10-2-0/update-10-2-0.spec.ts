import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import * as path from 'path';

describe('update 10.2.0', () => {
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
                builder: '@angular-devkit/build-angular:browser',
              },
              test: {
                builder: '@nrwl/jest:jest',
                options: {
                  jestConfig: 'apps/products/jest.config.js',
                  tsConfig: 'apps/products/tsconfig.spec.json',
                  setupFile: 'apps/products/src/test-setup.ts',
                  passWithNoTests: true,
                },
              },
            },
          },
          cart: {
            root: 'apps/cart',
            sourceRoot: 'apps/cart/src',
            architect: {
              build: {
                builder: '@nrwl/web:build',
              },
              test: {
                builder: '@nrwl/jest:jest',
                options: {
                  jestConfig: 'apps/cart/jest.config.js',
                  passWithNoTests: true,
                },
              },
            },
          },
        },
      })
    );
    schematicRunner = new SchematicTestRunner(
      '@nrwl/jest',
      path.join(__dirname, '../../../migrations.json')
    );
  });

  it('should remove setupFile and tsconfig in test architect from workspace.json', async () => {
    const result = await schematicRunner
      .runSchematicAsync('update-10.2.0', {}, initialTree)
      .toPromise();

    const updatedWorkspace = JSON.parse(result.readContent('workspace.json'));
    expect(updatedWorkspace.projects.products.architect.test.options).toEqual({
      jestConfig: expect.anything(),
      passWithNoTests: expect.anything(),
    });
    expect(updatedWorkspace.projects.cart.architect.test.options).toEqual({
      jestConfig: expect.anything(),
      passWithNoTests: expect.anything(),
    });
  });
});
