import type { StorybookConfig } from '@storybook/react-webpack5';

const config: StorybookConfig = {
  stories: ['../src/lib/**/*.stories.@(mdx|js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-docs', '@nx/react/plugins/storybook'],
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  docs: {},
};

export default config;
