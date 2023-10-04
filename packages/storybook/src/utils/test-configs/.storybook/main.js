module.exports = {
  core: { builder: 'webpack5' },
  stories: [
    '../src/app/**/*.stories.mdx',
    '../src/app/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: ['@storybook/addon-essentials', '@nx/react/plugins/storybook'],
};
