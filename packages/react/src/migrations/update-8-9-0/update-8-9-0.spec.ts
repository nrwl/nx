import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import {
  updateJsonInTree,
  readJsonInTree,
  updateWorkspaceInTree,
  readWorkspace,
  getWorkspacePath,
} from '@nrwl/workspace';

import * as path from 'path';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

describe('Update 8-9-0', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    tree = Tree.empty();
    schematicRunner = new SchematicTestRunner(
      '@nrwl/react',
      path.join(__dirname, '../../../migrations.json')
    );
  });

  it(`should update react to 16.12.0`, async () => {
    tree.create(
      'package.json',
      JSON.stringify({
        dependencies: {
          react: '16.0.0',
        },
      })
    );

    tree = await schematicRunner
      .runSchematicAsync('update-8.9.0', {}, tree)
      .toPromise();

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson.dependencies).toEqual({
      react: '16.12.0',
    });
  });

  it(`should replace redux-starter-kit with @reduxjs/toolkit`, async () => {
    tree.create(
      'package.json',
      JSON.stringify({
        dependencies: {
          'redux-starter-kit': '0.8.0',
        },
      })
    );

    tree.create(
      'apps/demo/src/main.tsx',
      stripIndents`
      import { configureStore } from 'redux-starter-kit';`
    );

    tree = await schematicRunner
      .runSchematicAsync('update-8.9.0', {}, tree)
      .toPromise();

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson.dependencies).toEqual({
      '@reduxjs/toolkit': '1.0.4',
    });

    const sourceCode = tree.read('apps/demo/src/main.tsx').toString();
    expect(sourceCode).toContain(
      `import { configureStore } from '@reduxjs/toolkit';`
    );
  });
});
