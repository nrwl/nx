import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import {
  readJsonInTree,
  updateJsonInTree,
  writeJsonInTree,
} from '@nrwl/workspace';
import * as path from 'path';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule } from '../utils/testing';

describe('Update 8-10-0', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    schematicRunner = new SchematicTestRunner(
      '@nrwl/react',
      path.join(__dirname, '../../../migrations.json')
    );

    schematicRunner.registerCollection(
      '@nrwl/cypress',
      path.join(__dirname, '../../../../cypress/collection.json')
    );
  });

  it(`should update libs`, async () => {
    writeJsonInTree(tree, 'package.json', {
      dependencies: {
        '@emotion/core': '10.0.23',
        '@emotion/styled': '10.0.23',
      },
      devDependencies: {
        '@types/react': '16.9.13',
      },
    });

    tree = await schematicRunner
      .runSchematicAsync('update-8.10.0', {}, tree)
      .toPromise();

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      dependencies: {
        '@emotion/core': '10.0.27',
        '@emotion/styled': '10.0.27',
      },
      devDependencies: {
        '@types/react': '16.9.17',
      },
    });
  });

  it('should add custom typings to react apps', async () => {
    const reactRunner = new SchematicTestRunner(
      '@nrwl/react',
      path.join(__dirname, '../../../collection.json')
    );

    reactRunner.registerCollection(
      '@nrwl/jest',
      path.join(__dirname, '../../../../jest/collection.json')
    );

    reactRunner.registerCollection(
      '@nrwl/cypress',
      path.join(__dirname, '../../../../cypress/collection.json')
    );
    tree = await reactRunner
      .runSchematicAsync('app', { name: 'demo' }, tree)
      .toPromise();
    tree = await reactRunner
      .runSchematicAsync(
        'app',
        { name: 'nested-app', directory: 'nested' },
        tree
      )
      .toPromise();

    tree = await callRule(
      updateJsonInTree(`nested/nested-app/tsconfig.json`, (json) => {
        json.files = [];
        return json;
      }),
      tree
    );

    tree = await schematicRunner
      .runSchematicAsync('update-8.10.0', {}, tree)
      .toPromise();

    let tsConfig = readJsonInTree(tree, `apps/demo/tsconfig.json`);
    expect(tsConfig.files).toContain(
      '../../node_modules/@nrwl/react/typings/image.d.ts'
    );

    tsConfig = readJsonInTree(tree, `apps/nested/nested-app/tsconfig.json`);
    expect(tsConfig.files).toContain(
      '../../../node_modules/@nrwl/react/typings/image.d.ts'
    );
  });

  it('should change `@nrwl/react/plugins/babel` with `@nrwl/react/plugins/webpack`', async () => {
    let workspaceJson = readJsonInTree(tree, '/workspace.json');
    workspaceJson.projects = {
      demo: {
        root: 'apps/demo',
        projectType: 'application',
        architect: {
          build: {
            builder: '@nrwl/web:build',
            options: {
              webpackConfig: '@nrwl/react/plugins/babel',
            },
          },
        },
      },
    };
    writeJsonInTree(tree, '/workspace.json', workspaceJson);

    tree = await schematicRunner
      .runSchematicAsync('update-8.10.0', {}, tree)
      .toPromise();

    workspaceJson = readJsonInTree(tree, '/workspace.json');
    expect(workspaceJson.projects).toEqual({
      demo: {
        root: 'apps/demo',
        projectType: 'application',
        architect: {
          build: {
            builder: '@nrwl/web:build',
            options: {
              webpackConfig: '@nrwl/react/plugins/webpack',
            },
          },
        },
      },
    });
  });
});
