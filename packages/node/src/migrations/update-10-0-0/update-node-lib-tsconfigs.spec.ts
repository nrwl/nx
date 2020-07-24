import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { serializeJson } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import * as path from 'path';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

describe('update 10.0.0', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(() => {
    initialTree = createEmptyWorkspace(Tree.empty());
    initialTree.create(
      'libs/products/tsconfig.lib.json',
      stripIndents`
      {
        "compilerOptions": {
          "rootDir": "./src",
          "outDir": "../../dist/out-tsc"
        }
      }
    `
    );
    initialTree.create(
      'libs/nested/cart/tsconfig.lib.json',
      stripIndents`
      {
        "compilerOptions": {
          "rootDir": "./src",
          "outDir": "../../dist/out-tsc"
        }
      }
    `
    );

    initialTree.overwrite(
      'workspace.json',
      serializeJson({
        version: 1,
        projects: {
          products: {
            root: 'libs/products',
            sourceRoot: 'libs/products/src',
            architect: {
              build: {
                builder: '@nrwl/node:package',
                options: {
                  outputPath: 'dist/libs/products',
                  tsConfig: 'libs/products/tsconfig.lib.json',
                  packageJson: 'libs/products/package.json',
                  main: 'libs/products/src/index.ts',
                  assets: ['libs/products/*.md'],
                },
              },
            },
          },
          cart: {
            root: 'libs/nested/cart',
            sourceRoot: 'libs/nested/cart/src',
            architect: {
              build: {
                builder: '@nrwl/node:package',
                options: {
                  outputPath: 'dist/libs/nested/cart',
                  tsConfig: 'libs/nested/cart/tsconfig.lib.json',
                  packageJson: 'libs/nested/cart/package.json',
                  main: 'libs/nested/cart/src/index.ts',
                  assets: ['libs/nested/cart/*.md'],
                },
              },
            },
          },
        },
      })
    );

    schematicRunner = new SchematicTestRunner(
      '@nrwl/node',
      path.join(__dirname, '../../../migrations.json')
    );
  });

  it('should update tsconfig.lib.json for projects that have @nrwl/node:package', async () => {
    const result = await schematicRunner
      .runSchematicAsync('update-node-lib-tsconfigs', {}, initialTree)
      .toPromise();

    const tsConfig = JSON.parse(
      result.readContent('libs/products/tsconfig.lib.json')
    );
    expect(tsConfig.compilerOptions.rootDir).toBeUndefined();
    expect(tsConfig.compilerOptions.outDir).toEqual('../../dist');

    const tsConfig2 = JSON.parse(
      result.readContent('libs/nested/cart/tsconfig.lib.json')
    );
    expect(tsConfig2.compilerOptions.rootDir).toBeUndefined();
    expect(tsConfig2.compilerOptions.outDir).toEqual('../../../dist');
  });
});
