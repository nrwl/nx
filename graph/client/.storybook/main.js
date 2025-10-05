module.exports = {
  stories: ['../src/app/**/*.stories.@(mdx|js|jsx|ts|tsx)'],
  addons: ['@nx/react/plugins/storybook', 'storybook-dark-mode'],
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  docs: {},
};
