/* eslint-disable @nx/enforce-module-boundaries */
import { mergeConfig } from 'vite';

export default {
  stories: ['../src/lib/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: ['@storybook/addon-docs'],

  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
  docs: {},
  viteFinal: async (config) => {
    const {
      nxViteTsPaths,
      // nx-ignore-next-line
    } = await import('@nx/vite/plugins/nx-tsconfig-paths.plugin');
    return mergeConfig(config, {
      plugins: [nxViteTsPaths()],
    });
  },
};
