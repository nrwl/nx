import {
  addProjectConfiguration,
  readProjectConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { updateExternalEmotionJsxRuntime } from './update-external-emotion-jsx-runtime';

describe('updateExternalEmotionJsxRuntime', () => {
  it('should update external for Emotion', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'components', {
      root: 'libs/components',
      targets: {
        build: {
          executor: '@nrwl/web:rollup',
          options: {
            external: ['@emotion/styled/base', 'react/jsx-runtime'],
          },
        },
      },
    });
    tree.write(
      'libs/components/.babelrc',
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

    // ACT
    await updateExternalEmotionJsxRuntime(tree);

    // ASSERT
    const { targets } = readProjectConfiguration(tree, 'components');
    expect(targets.build.options.external).toEqual([
      '@emotion/react/jsx-runtime',
    ]);
  });

  it('should not fail for projects with no targets', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'components', {
      root: 'apps/components',
    });

    // ACT
    await updateExternalEmotionJsxRuntime(tree);

    // ASSERT
    const { targets } = readProjectConfiguration(tree, 'components');
    expect(targets).toBeUndefined();
  });
});
