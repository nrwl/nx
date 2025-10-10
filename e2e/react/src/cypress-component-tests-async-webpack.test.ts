import {
  cleanupProject,
  createFile,
  runCLI,
  runE2ETests,
  updateJson,
} from '@nx/e2e-utils';
import { join } from 'path';
import { setupCypressComponentTests } from './cypress-component-tests-setup';

describe('React Cypress Component Tests - async webpack', () => {
  let projectName;
  let appName;

  beforeAll(async () => {
    const setup = setupCypressComponentTests();
    projectName = setup.projectName;
    appName = setup.appName;
  });

  afterAll(() => {
    cleanupProject();
    delete process.env.NX_ADD_PLUGINS;
  });

  it('should work with async webpack config', async () => {
    // TODO: (caleb) for whatever reason the MF webpack config + CT is running, but cypress is not starting up?
    // are they overriding some option on top of each other causing cypress to not see it's running?
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
