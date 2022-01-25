import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { readJson, writeJson, Tree } from '@nrwl/devkit';
import { updateExistingBabelrcFiles } from './update-existing-babelrc-files';

describe('Create missing .babelrc files', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it(`should add web babel preset if it does not exist`, async () => {
    writeJson(tree, 'workspace.json', {
      projects: {
        'missing-babel-presets': {
          root: 'apps/missing-babel-presets',
          projectType: 'application',
        },
        'web-app': {
          root: 'apps/web-app',
          projectType: 'application',
        },
        'react-app': {
          root: 'apps/react-app',
          projectType: 'application',
        },
        'not-using-babel': {
          root: 'apps/not-using-babel',
          projectType: 'application',
        },
        'next-app': {
          root: 'apps/next-app',
          projectType: 'application',
        },
      },
    });
    writeJson(tree, 'nx.json', {
      projects: {
        'missing-babel-presets': {},
        'web-app': {},
        'react-app': {},
        'not-using-babel': {},
        'next-app': {},
      },
    });
    writeJson(tree, 'babel.config.json', {
      presets: ['@nrwl/web/babel'],
    });
    writeJson(tree, 'apps/missing-babel-presets/.babelrc', {});
    writeJson(tree, 'apps/web-app/.babelrc', { presets: ['@nrwl/web/babel'] });
    writeJson(tree, 'apps/react-app/.babelrc', {
      presets: ['@nrwl/react/babel'],
    });
    writeJson(tree, 'apps/next-app/.babelrc', {
      presets: ['@nrwl/next/babel'],
    });

    await updateExistingBabelrcFiles(tree);

    expect(readJson(tree, 'apps/missing-babel-presets/.babelrc')).toMatchObject(
      {
        presets: ['@nrwl/web/babel'],
      }
    );

    expect(readJson(tree, 'apps/web-app/.babelrc')).toMatchObject({
      presets: ['@nrwl/web/babel'],
    });

    expect(readJson(tree, 'apps/react-app/.babelrc')).toMatchObject({
      presets: ['@nrwl/react/babel'],
    });

    expect(tree.exists('apps/not-using-babel/.babelrc')).not.toBeTruthy();

    expect(readJson(tree, 'apps/next-app/.babelrc')).toMatchObject({
      presets: ['@nrwl/next/babel'],
    });
  });
});
