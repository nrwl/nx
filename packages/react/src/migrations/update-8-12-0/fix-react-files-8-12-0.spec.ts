import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { readJsonInTree } from '@nrwl/workspace';
import * as path from 'path';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';

describe('Update 8-12-0', () => {
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

  it(`should add react preset and webpack config (if missing)`, async () => {
    tree.overwrite(
      'package.json',
      JSON.stringify({
        dependencies: {},
        devDependencies: {},
      })
    );

    tree.overwrite(
      'workspace.json',
      JSON.stringify({
        projects: {
          demo: {
            architect: {
              build: {
                builder: '@nrwl/web:build',
                options: {
                  main: 'apps/demo/src/main.tsx',
                },
              },
            },
          },
        },
      })
    );

    tree = await schematicRunner
      .runSchematicAsync('fix-react-files-8.12.0', {}, tree)
      .toPromise();

    const workspaceJson = readJsonInTree(tree, '/workspace.json');
    const packageJson = readJsonInTree(tree, '/package.json');
    expect(workspaceJson).toMatchObject({
      projects: {
        demo: {
          architect: {
            build: {
              builder: '@nrwl/web:build',
              options: {
                main: 'apps/demo/src/main.tsx',
                webpackConfig: '@nrwl/react/plugins/webpack',
              },
            },
          },
        },
      },
    });
    expect(packageJson).toMatchObject({
      dependencies: {},
      devDependencies: {
        '@babel/preset-react': '7.8.3',
      },
    });
  });
});
