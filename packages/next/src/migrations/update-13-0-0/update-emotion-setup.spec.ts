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
          'plain-next-app': {
            root: 'apps/plain-next-app',
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
          'plain-next-app': {},
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
      'apps/plain-next-app/.babelrc',
      JSON.stringify({
        presets: ['@nrwl/next/babel'],
        plugins: [],
      })
    );
    tree.write(
      'apps/plain-next-app/tsconfig.json',
      JSON.stringify({ compilerOptions: { jsx: 'preserve' } })
    );
    tree.write(
      'apps/emotion-app/.babelrc',
      JSON.stringify({
        presets: [
          [
            '@nrwl/next/babel',
            {
              'preset-react': {
                runtime: 'automatic',
                importSource: '@emotion/react',
              },
            },
          ],
        ],
        plugins: ['@emotion/babel-plugin'],
      })
    );
    tree.write(
      'apps/emotion-app/tsconfig.json',
      JSON.stringify({ compilerOptions: { jsx: 'preserve' } })
    );

    await updateEmotionSetup(tree);

    expect(readJson(tree, 'apps/no-emotion-app/tsconfig.json')).toEqual({
      compilerOptions: {},
    });
    expect(readJson(tree, 'apps/plain-next-app/tsconfig.json')).toEqual({
      compilerOptions: { jsx: 'preserve' },
    });
    expect(readJson(tree, 'apps/emotion-app/tsconfig.json')).toEqual({
      compilerOptions: { jsx: 'preserve', jsxImportSource: '@emotion/react' },
    });
  });
});
