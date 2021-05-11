import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { readJson, Tree, writeJson } from '@nrwl/devkit';
import updateBabelConfig from './update-babel-config';

describe('Migrate babel setup', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it(`should add web babel preset if it does not exist`, async () => {
    writeJson(tree, 'workspace.json', {
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
    });
    writeJson(tree, 'nx.json', {
      projects: {
        app1: {},
        app2: {},
        app3: {},
      },
    });
    writeJson(tree, 'apps/app1/.babelrc', {
      presets: ['@nrwl/react/babel'],
    });
    writeJson(tree, 'apps/app2/.babelrc', { presets: ['next/babel'] });

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
