import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { serializeJson } from '@nrwl/workspace';
import * as path from 'path';

describe('update 10.1.0', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;

  const tsConfig = String.raw`
  {
    "extends": "./tsconfig.json",
    "compilerOptions": {
      "module": "commonjs",
      "outDir": "../../dist/out-tsc",
      "declaration": true,
      "rootDir": "./src",
      "types": ["node"]
    },
    "exclude": ["**/*.spec.ts"],
    "include": ["**/*.ts"]
  }
  `;

  beforeEach(() => {
    initialTree = createEmptyWorkspace(Tree.empty());
    initialTree.create('libs/my-node-lib/tsconfig.lib.json', tsConfig);
    initialTree.overwrite(
      'workspace.json',
      serializeJson({
        version: 1,
        projects: {
          'my-node-lib': {
            root: 'libs/my-node-lib',
            sourceRoot: 'libs/my-node-lib/src',
            projectType: 'library',
            schematics: {},
            architect: {
              build: {
                builder: '@nrwl/node:package',
                options: {
                  outputPath: 'dist/libs/my-node-lib',
                  tsConfig: 'libs/my-node-lib/tsconfig.lib.json',
                  packageJson: 'libs/my-node-lib/package.json',
                  main: 'libs/my-node-lib/src/index.ts',
                  assets: ['libs/my-node-lib/*.md'],
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

  it('should remove rootDir from tsconfigs', async () => {
    const result = await schematicRunner
      .runSchematicAsync('remove-root-dir', {}, initialTree)
      .toPromise();

    const updatedTsConfig = JSON.parse(
      result.readContent('libs/my-node-lib/tsconfig.lib.json')
    );
    expect(updatedTsConfig).toEqual({
      extends: './tsconfig.json',
      compilerOptions: {
        module: 'commonjs',
        outDir: '../../dist/out-tsc',
        declaration: true,
        types: ['node'],
      },
      exclude: ['**/*.spec.ts'],
      include: ['**/*.ts'],
    });

    const workspace = JSON.parse(result.readContent('workspace.json'));
    expect(workspace.projects['my-node-lib'].architect.build.options).toEqual({
      outputPath: 'dist/libs/my-node-lib',
      tsConfig: 'libs/my-node-lib/tsconfig.lib.json',
      packageJson: 'libs/my-node-lib/package.json',
      main: 'libs/my-node-lib/src/index.ts',
      assets: ['libs/my-node-lib/*.md'],
      srcRootForCompilationRoot: 'libs/my-node-lib/src',
    });
  });
});
