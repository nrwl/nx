import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { readJsonInTree } from '@nrwl/workspace';

describe('Migrate babel setup', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    schematicRunner = new SchematicTestRunner(
      '@nrwl/next',
      path.join(__dirname, '../../../migrations.json')
    );
  });

  it(`should add web babel preset if it does not exist`, async () => {
    tree.overwrite(
      'workspace.json',
      JSON.stringify({
        projects: {
          app1: {
            root: 'apps/app1',
          },
          app2: {
            root: 'apps/app2',
          },
          app3: {
            root: 'apps/app3',
          },
        },
      })
    );
    tree.overwrite(
      'nx.json',
      JSON.stringify({
        projects: {
          app1: {},
          app2: {},
          app3: {},
        },
      })
    );
    tree.create(
      'apps/app1/.babelrc',
      JSON.stringify({
        presets: ['@nrwl/react/babel'],
      })
    );
    tree.create(
      'apps/app2/.babelrc',
      JSON.stringify({ presets: ['next/babel'] })
    );

    tree = await schematicRunner
      .runSchematicAsync('update-babel-config-11.5.0', {}, tree)
      .toPromise();

    expect(readJsonInTree(tree, 'apps/app1/.babelrc')).toMatchObject({
      presets: ['@nrwl/react/babel'],
    });

    expect(readJsonInTree(tree, 'apps/app2/.babelrc')).toMatchObject({
      presets: ['@nrwl/next/babel'],
    });

    expect(tree.exists('apps/app3/.babelrc')).not.toBeTruthy();
  });
});
