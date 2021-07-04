import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { serializeJson } from '@nrwl/devkit';
import { readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import * as path from 'path';

describe('update 10.2.0', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(() => {
    initialTree = createEmptyWorkspace(Tree.empty());

    initialTree.overwrite(
      'workspace.json',
      serializeJson({
        version: 1,
        projects: {
          'my-plugin-e2e': {
            projectType: 'application',
            root: 'apps/my-plugin-e2e',
            sourceRoot: 'apps/my-plugin-e2e/src',
            architect: {
              e2e: {
                builder: '@nrwl/nx-plugin:e2e',
                options: {
                  target: 'my-plugin:build',
                  npmPackageName: '@repo/my-plugin',
                  pluginOutputPath: 'dist/libs/my-plugin',
                  jestConfig: 'apps/my-plugin-e2e/jest.config.js',
                  tsSpecConfig: 'apps/my-plugin-e2e/tsconfig.spec.json',
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

    const updatedWorkspace = readJsonInTree(result, 'workspace.json');
    expect(
      updatedWorkspace.projects['my-plugin-e2e'].architect.e2e.options
    ).toEqual({
      target: expect.anything(),
      npmPackageName: expect.anything(),
      pluginOutputPath: expect.anything(),
      jestConfig: expect.anything(),
    });
  });
});
