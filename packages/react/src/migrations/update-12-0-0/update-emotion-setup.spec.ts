import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { readJson, Tree } from '@nrwl/devkit';
import { updateEmotionSetup } from './update-emotion-setup';

describe('Update babel config for emotion', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it(`should add web babel preset if it does not exist`, async () => {
    tree.write(
      'workspace.json',
      JSON.stringify({
        projects: {
          'no-emotion-app': {
            root: 'apps/no-emotion-app',
            projectType: 'application',
          },
          'plain-react-app': {
            root: 'apps/plain-react-app',
            projectType: 'application',
          },
          'emotion-app': {
            root: 'apps/emotion-app',
            projectType: 'application',
          },
          'emotion-with-options-app': {
            root: 'apps/emotion-with-options-app',
            projectType: 'application',
          },
        },
      })
    );
    tree.write(
      'nx.json',
      JSON.stringify({
        projects: {
          'no-emotion-app': {},
          'plain-react-app': {},
          'emotion-app': {},
          'emotion-with-options-app': {},
        },
      })
    );
    tree.write('apps/no-emotion-app/.babelrc', JSON.stringify({}));
    tree.write(
      'apps/plain-react-app/.babelrc',
      JSON.stringify({
        presets: ['@nrwl/react/babel'],
        plugins: ['@babel/whatever'],
      })
    );
    tree.write(
      'apps/emotion-app/.babelrc',
      JSON.stringify({ presets: ['@emotion/babel-preset-css-prop'] })
    );
    tree.write(
      'apps/emotion-with-options-app/.babelrc',
      JSON.stringify({
        presets: [
          ['@emotion/babel-preset-css-prop', { autoLabel: 'dev-only' }],
        ],
      })
    );

    await updateEmotionSetup(tree);

    expect(readJson(tree, 'apps/no-emotion-app/.babelrc')).toEqual({});
    expect(readJson(tree, 'apps/plain-react-app/.babelrc')).toEqual({
      presets: ['@nrwl/react/babel'],
      plugins: ['@babel/whatever'],
    });
    expect(readJson(tree, 'apps/emotion-app/.babelrc')).toEqual({
      presets: [],
      plugins: ['@emotion/babel-plugin'],
    });
    expect(readJson(tree, 'apps/emotion-with-options-app/.babelrc')).toEqual({
      presets: [],
      plugins: [['@emotion/babel-plugin', { autoLabel: 'dev-only' }]],
    });
  });

  it('should remove `@emotion/babel-preset-css-prop` and add `@emotion/babel-plugin@11.2.0` in `devDependencies', async () => {
    tree.write(
      'package.json',
      JSON.stringify({
        devDependencies: {
          '@emotion/babel-preset-css-prop': '11.0.0',
        },
      })
    );

    await updateEmotionSetup(tree);

    const json = JSON.parse(tree.read('package.json').toString());
    expect(json).toEqual({
      devDependencies: {
        '@emotion/babel-plugin': '11.2.0',
      },
    });
  });

  it('should remove `@emotion/babel-preset-css-prop` and add `@emotion/babel-plugin@11.2.0` in `dependencies', async () => {
    tree.write(
      'package.json',
      JSON.stringify({
        dependencies: {
          '@emotion/babel-preset-css-prop': '11.0.0',
        },
      })
    );

    await updateEmotionSetup(tree);

    const json = JSON.parse(tree.read('package.json').toString());
    expect(json).toEqual({
      dependencies: {
        '@emotion/babel-plugin': '11.2.0',
      },
    });
  });
});
