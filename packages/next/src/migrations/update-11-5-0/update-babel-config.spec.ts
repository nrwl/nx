import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { readJson, Tree } from '@nrwl/devkit';
import updateBabelConfig from './update-babel-config';

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
    tree.write(
      'nx.json',
      JSON.stringify({
        projects: {
          app1: {},
          app2: {},
          app3: {},
        },
      })
    );
    tree.write(
      'apps/app1/.babelrc',
      JSON.stringify({
        presets: ['@nrwl/react/babel'],
      })
    );
    tree.write(
      'apps/app2/.babelrc',
      JSON.stringify({ presets: ['next/babel'] })
    );

    await updateBabelConfig(tree);

    expect(readJson(tree, 'apps/app1/.babelrc')).toMatchObject({
      presets: ['@nrwl/react/babel'],
    });

    expect(readJson(tree, 'apps/app2/.babelrc')).toMatchObject({
      presets: ['@nrwl/next/babel'],
    });

    expect(tree.exists('apps/app3/.babelrc')).not.toBeTruthy();
  });
});
