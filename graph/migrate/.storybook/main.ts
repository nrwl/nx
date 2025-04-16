/* eslint-disable @nx/enforce-module-boundaries */
import type { StorybookConfig } from '@storybook/react-vite';

// nx-ignore-next-line
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: ['../src/lib/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],

  framework: {
    name: '@storybook/react-vite',
    options: {},
  },

  viteFinal: async (config) =>
    mergeConfig(config, {
      plugins: [nxViteTsPaths()],
    }),

  docs: {},
};

export default config;

// To customize your Vite configuration you can use the viteFinal field.
// Check https://storybook.js.org/docs/react/builders/vite#configuration
// and https://nx.dev/recipes/storybook/custom-builder-configs
