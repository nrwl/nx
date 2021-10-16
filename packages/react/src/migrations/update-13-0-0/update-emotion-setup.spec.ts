import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { readJson, Tree } from '@nrwl/devkit';
import { updateEmotionSetup } from './update-emotion-setup';

describe('Update tsconfig config for Emotion', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it(`should add jsxImportSource if it uses @emotion/react`, async () => {
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
        },
      })
    );
    tree.write('apps/no-emotion-app/.babelrc', JSON.stringify({}));
    tree.write(
      'apps/no-emotion-app/tsconfig.json',
      JSON.stringify({ compilerOptions: {} })
    );
    tree.write(
      'apps/plain-react-app/.babelrc',
      JSON.stringify({
        presets: ['@nrwl/react/babel'],
        plugins: [],
      })
    );
    tree.write(
      'apps/plain-react-app/tsconfig.json',
      JSON.stringify({ compilerOptions: { jsx: 'react-jsx' } })
    );
    tree.write(
      'apps/emotion-app/.babelrc',
      JSON.stringify({
        presets: [
          [
            '@nrwl/react/babel',
            {
              runtime: 'automatic',
              importSource: '@emotion/react',
            },
          ],
        ],
        plugins: ['@emotion/babel-plugin'],
      })
    );
    tree.write(
      'apps/emotion-app/tsconfig.json',
      JSON.stringify({ compilerOptions: { jsx: 'react-jsx' } })
    );

    await updateEmotionSetup(tree);

    expect(readJson(tree, 'apps/no-emotion-app/tsconfig.json')).toEqual({
      compilerOptions: {},
    });
    expect(readJson(tree, 'apps/plain-react-app/tsconfig.json')).toEqual({
      compilerOptions: { jsx: 'react-jsx' },
    });
    expect(readJson(tree, 'apps/emotion-app/tsconfig.json')).toEqual({
      compilerOptions: { jsx: 'react-jsx', jsxImportSource: '@emotion/react' },
    });
  });
});
