/* eslint-disable @nx/enforce-module-boundaries */
import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';

// Pointing directly to node_modules so we don't transpile from source and up with with an error.
// e.g.  Cannot find module '../../bin/run-executor.js'
// Require stack:
// - packages/nx/src/tasks-runner/utils.ts
// - packages/nx/src/devkit-exports.ts
// - packages/devkit/index.ts
// - /packages/vite/plugins/nx-tsconfig-paths.plugin.ts
// nx-ignore-next-line
import { nxViteTsPaths } from '../../../node_modules/@nx/vite/plugins/nx-tsconfig-paths.plugin';

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
};

export default config;
