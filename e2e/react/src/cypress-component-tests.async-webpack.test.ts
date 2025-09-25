import { createFile, runCLI, runE2ETests, updateFile } from '@nx/e2e-utils';
import { join } from 'path';

import {
  setupReactCypressSuite,
  teardownReactCypressSuite,
} from './cypress-component-tests.setup';

describe('React Cypress Component Tests - async webpack', () => {
  const context = setupReactCypressSuite();

  afterAll(() => teardownReactCypressSuite());

  it('should work with async webpack config', async () => {
    createFile(
      `apps/${context.appName}/webpack.config.js`,
      `
        const { composePlugins, withNx } = require('@nx/webpack');
        const { withReact } = require('@nx/react');

        module.exports = composePlugins(
          withNx(),
          withReact(),
          async function (configuration) {
            await new Promise((res) => {
              setTimeout(() => {
                console.log('I am from the custom async Webpack config');
                res();
              }, 1000);
            });
            return configuration;
          }
        );
      `
    );
    updateJson(join('apps', context.appName, 'project.json'), (config) => {
      config.targets['build'].options.webpackConfig = `apps/${context.appName}/webpack.config.js`;
      return config;
    });

    if (runE2ETests()) {
      const results = runCLI(`component-test ${context.appName}`);
      expect(results).toContain('I am from the custom async Webpack config');
      expect(results).toContain('All specs passed!');
    }
  });
});

