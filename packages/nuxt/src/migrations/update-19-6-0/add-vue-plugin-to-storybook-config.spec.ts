import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import addVuePluginToStorybookConfig from './add-vue-plugin-to-storybook-config';
describe('addVuePluginToStorybookConfig', () => {
  it('should update the storybook config to add the vue() plugin when the project is nuxt', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/nuxt/.storybook/main.ts',
      `import type { StorybookConfig } from '@storybook/vue3-vite';

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/vue3-vite',
    options: {},
  },

  viteFinal: async (config) =>
    mergeConfig(config, {
      plugins: [nxViteTsPaths()],
    }),
};

export default config;`
    );

    tree.write('apps/nuxt/nuxt.config.ts', '');

    // ACT
    await addVuePluginToStorybookConfig(tree);

    // ASSERT
    expect(tree.read('apps/nuxt/.storybook/main.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import vue from '@vitejs/plugin-vue';
      import type { StorybookConfig } from '@storybook/vue3-vite';

      import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
      import { mergeConfig } from 'vite';

      const config: StorybookConfig = {
        stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
        addons: ['@storybook/addon-essentials'],
        framework: {
          name: '@storybook/vue3-vite',
          options: {},
        },

        viteFinal: async (config) =>
          mergeConfig(config, {
            plugins: [vue(), nxViteTsPaths()],
          }),
      };

      export default config;
      "
    `);
  });
});
