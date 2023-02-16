export default {
  stories: [
    '../src/app/**/*.stories.mdx',
    '../src/app/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: [
    '@storybook/addon-essentials',
    '@nrwl/react/plugins/storybook',
    'storybook-dark-mode',
  ],
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
};
