import { nxBaseCypressPreset } from '@nrwl/cypress/plugins/cypress-preset';
import { workspaceLayout } from 'nx/src/project-graph/file-utils';
import { workspaceRoot } from 'nx/src/utils/app-root';
import { join, resolve } from 'path';
// doesn't like ESM imports
const findNextWebpackConfig = require('@cypress/react/plugins/next/findNextWebpackConfig');

/**
 * nx Component Testing Preset for Cypress
 * @description
 * this preset contains the base configuration
 * for your component tests that nx recommends.
 * including a devServer that supports nx workspaces.
 * you can easily extend this within your cypress config via spreading the preset
 * @example
 * export default defineConfig({
 *   component: {
 *     ...nxComponentTestingPreset(__dirname)
 *     // add your own config here
 *   }
 * })
 *
 * @param pathToConfig will be used to construct the output paths for videos and screenshots
 */
export function nxComponentTestingPreset(pathToConfig: string) {
  return {
    ...nxBaseCypressPreset(pathToConfig),
    devServer: componentDevServer(),
  };
}

/**
 * Start the devserver for Cypress component tests with a NextJS project.
 */
export function componentDevServer() {
  return async (cypressConfigOptions) => {
    // when getting the next config it will look for a next.config.js file and run it.
    // this will run the withNx() plugin which adds support for css modules and libs.
    // also allows for extending the webpack config as needed.
    const webpackConfig = await findNextWebpackConfig(
      cypressConfigOptions.config
    );

    if (!webpackConfig) {
      throw new Error(
        'Could not find a webpack config for next. is @nrwl/next installed?'
      );
    }
    const nextLoaders = webpackConfig.module.rules.find(
      (rule: any) => typeof rule.oneOf === 'object'
    );

    const moduleLoaders = nextLoaders.oneOf.filter((rule) =>
      regexEqual(rule.test, /\.(tsx|ts|js|cjs|mjs|jsx)$/)
    );

    if (moduleLoaders) {
      const { libsDir } = workspaceLayout();
      const libPath = join(workspaceRoot, libsDir);

      for (const moduleLoader of moduleLoaders) {
        moduleLoader.include.push(libPath);
      }
    }

    // needs to be imported after loading the webpack config from next;
    const { startDevServer } = require('@cypress/webpack-dev-server');

    return startDevServer({
      options: cypressConfigOptions,
      webpackConfig,
      template: resolve(__dirname, 'next.template.html'),
    });
  };
}

function regexEqual(x, y) {
  return (
    x instanceof RegExp &&
    y instanceof RegExp &&
    x.source === y.source &&
    x.global === y.global &&
    x.ignoreCase === y.ignoreCase &&
    x.multiline === y.multiline
  );
}
