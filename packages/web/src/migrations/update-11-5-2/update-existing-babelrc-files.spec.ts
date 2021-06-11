import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { readJson, Tree } from '@nrwl/devkit';
import { updateExistingBabelrcFiles } from './update-existing-babelrc-files';

describe('Create missing .babelrc files', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it(`should add web babel preset if it does not exist`, async () => {
    tree.write(
      'workspace.json',
      JSON.stringify({
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
          'gatsby-app': {
            root: 'apps/gatsby-app',
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
      })
    );
    tree.write(
      'nx.json',
      JSON.stringify({
        projects: {
          'missing-babel-presets': {},
          'web-app': {},
          'react-app': {},
          'gatsby-app': {},
          'not-using-babel': {},
          'next-app': {},
        },
      })
    );
    tree.write(
      'babel.config.json',
      JSON.stringify({
        presets: ['@nrwl/web/babel'],
      })
    );
    tree.write('apps/missing-babel-presets/.babelrc', JSON.stringify({}));
    tree.write(
      'apps/web-app/.babelrc',
      JSON.stringify({ presets: ['@nrwl/web/babel'] })
    );
    tree.write(
      'apps/react-app/.babelrc',
      JSON.stringify({ presets: ['@nrwl/react/babel'] })
    );
    tree.write(
      'apps/gatsby-app/.babelrc',
      JSON.stringify({ presets: ['@nrwl/gatsby/babel'] })
    );
    tree.write(
      'apps/next-app/.babelrc',
      JSON.stringify({ presets: ['@nrwl/next/babel'] })
    );

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

    expect(readJson(tree, 'apps/gatsby-app/.babelrc')).toMatchObject({
      presets: ['@nrwl/gatsby/babel'],
    });

    expect(tree.exists('apps/not-using-babel/.babelrc')).not.toBeTruthy();

    expect(readJson(tree, 'apps/next-app/.babelrc')).toMatchObject({
      presets: ['@nrwl/next/babel'],
    });
  });
});
