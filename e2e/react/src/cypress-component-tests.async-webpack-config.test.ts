import {
  cleanupProject,
  createFile,
  newProject,
  runCLI,
  runE2ETests,
  uniq,
  updateJson,
} from '@nx/e2e-utils';
import { join } from 'path';

describe('React Cypress Component Tests - async webpack config', () => {
  beforeAll(async () => {
    newProject({ name: uniq('cy-react'), packages: ['@nx/react'] });
  });

  afterAll(() => cleanupProject());

  it('should work with async webpack config', async () => {
    const appName = uniq('cy-react-app');
    runCLI(
      `generate @nx/react:app apps/${appName} --bundler=webpack --no-interactive`
    );

    createFile(
      `apps/${appName}/webpack.config.js`,
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
    updateJson(join('apps', appName, 'project.json'), (config) => {
      config.targets[
        'build'
      ].options.webpackConfig = `apps/${appName}/webpack.config.js`;
      return config;
    });

    if (runE2ETests()) {
      const results = runCLI(`component-test ${appName}`);
      expect(results).toContain('I am from the custom async Webpack config');
      expect(results).toContain('All specs passed!');
    }
  });
});
