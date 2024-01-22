module.exports = {
  stories: ['../src/lib/**/*.stories.@(mdx|js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@nx/react/plugins/storybook'],
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  docs: {
    autodocs: true,
  },
};
