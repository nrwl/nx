export default {
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  stories: [
    '../src/lib/**/*.stories.mdx',
    '../src/lib/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: ['@storybook/addon-essentials', '@nrwl/react/plugins/storybook'],
};
