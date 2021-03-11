import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { readJson, Tree } from '@nrwl/devkit';
import { updateBabelConfig } from './update-babel-config';
describe('Migrate babel setup', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it(`should add web babel preset if it does not exist`, async () => {
    tree.write(
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
          app6: {
            root: 'apps/app6',
            projectType: 'application',
          },
          lib1: {
            root: 'libs/lib1',
            projectType: 'library',
          },
        },
      })
    );
    tree.write(
      'nx.json',
      JSON.stringify({
        projects: {
          app1: {},
          app2: {},
          app3: {},
          app4: {},
          app5: {},
          app6: {},
          lib1: {},
        },
      })
    );
    tree.write(
      'babel.config.json',
      JSON.stringify({
        presets: ['@nrwl/web/babel'],
      })
    );
    tree.write('apps/app1/.babelrc', JSON.stringify({}));
    tree.write(
      'apps/app2/.babelrc',
      JSON.stringify({ presets: ['@nrwl/web/babel'] })
    );
    tree.write(
      'apps/app3/.babelrc',
      JSON.stringify({ presets: ['@nrwl/react/babel'] })
    );
    tree.write(
      'apps/app4/.babelrc',
      JSON.stringify({ presets: ['@nrwl/gatsby/babel'] })
    );
    tree.write(
      'apps/app6/.babelrc',
      JSON.stringify({ presets: ['@nrwl/next/babel'] })
    );

    await updateBabelConfig(tree);

    expect(readJson(tree, 'babel.config.json').presets).not.toContain(
      '@nrwl/web/babel'
    );

    expect(readJson(tree, 'apps/app1/.babelrc')).toMatchObject({
      presets: ['@nrwl/web/babel'],
    });

    expect(readJson(tree, 'apps/app2/.babelrc')).toMatchObject({
      presets: ['@nrwl/web/babel'],
    });

    expect(readJson(tree, 'apps/app3/.babelrc')).toMatchObject({
      presets: ['@nrwl/react/babel'],
    });

    expect(readJson(tree, 'apps/app4/.babelrc')).toMatchObject({
      presets: ['@nrwl/gatsby/babel'],
    });

    expect(tree.exists('apps/app5/.babelrc')).not.toBeTruthy();

    expect(readJson(tree, 'apps/app6/.babelrc')).toMatchObject({
      presets: ['@nrwl/next/babel'],
    });

    expect(readJson(tree, 'libs/lib1/.babelrc')).toMatchObject({
      presets: ['@nrwl/web/babel'],
    });
  });
});
