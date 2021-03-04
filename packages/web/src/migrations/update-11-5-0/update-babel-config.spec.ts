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
      '@nrwl/web',
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
            projectType: 'application',
          },
          app2: {
            root: 'apps/app2',
            projectType: 'application',
          },
          app3: {
            root: 'apps/app3',
            projectType: 'application',
          },
          app4: {
            root: 'apps/app4',
            projectType: 'application',
          },
          app5: {
            root: 'apps/app5',
            projectType: 'application',
          },
          lib1: {
            root: 'libs/lib1',
            projectType: 'library',
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
          app4: {},
          app5: {},
          lib1: {},
        },
      })
    );
    tree.create(
      'babel.config.json',
      JSON.stringify({
        presets: ['@nrwl/web/babel'],
      })
    );
    tree.create('apps/app1/.babelrc', JSON.stringify({}));
    tree.create(
      'apps/app2/.babelrc',
      JSON.stringify({ presets: ['@nrwl/web/babel'] })
    );
    tree.create(
      'apps/app3/.babelrc',
      JSON.stringify({ presets: ['@nrwl/react/babel'] })
    );
    tree.create(
      'apps/app4/.babelrc',
      JSON.stringify({ presets: ['@nrwl/gatsby/babel'] })
    );

    tree = await schematicRunner
      .runSchematicAsync('update-babel-config-11.5.0', {}, tree)
      .toPromise();

    expect(readJsonInTree(tree, 'babel.config.json').presets).not.toContain(
      '@nrwl/web/babel'
    );

    expect(readJsonInTree(tree, 'apps/app1/.babelrc')).toMatchObject({
      presets: ['@nrwl/web/babel'],
    });

    expect(readJsonInTree(tree, 'apps/app2/.babelrc')).toMatchObject({
      presets: ['@nrwl/web/babel'],
    });

    expect(readJsonInTree(tree, 'apps/app3/.babelrc')).toMatchObject({
      presets: ['@nrwl/react/babel'],
    });

    expect(readJsonInTree(tree, 'apps/app4/.babelrc')).toMatchObject({
      presets: ['@nrwl/gatsby/babel'],
    });

    expect(tree.exists('apps/app5/.babelrc')).not.toBeTruthy();

    expect(readJsonInTree(tree, 'libs/lib1/.babelrc')).toMatchObject({
      presets: ['@nrwl/web/babel'],
    });
  });
});
