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
  viteFinal: async (config) =>
    mergeConfig(config, { resolve: { tsconfigPaths: true } }),
};
