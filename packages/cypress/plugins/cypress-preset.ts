import {
  createProjectGraphAsync,
  logger,
  parseTargetString,
  workspaceRoot,
} from '@nx/devkit';
import { dirname, join, relative } from 'path';
import { lstatSync } from 'fs';

import vitePreprocessor from '../src/plugins/preprocessor-vite';
import { ChildProcess, fork } from 'node:child_process';
import { createExecutorContext } from '../src/utils/ct-helpers';
import { startDevServer } from '../src/utils/start-dev-server';

interface BaseCypressPreset {
  videosFolder: string;
  screenshotsFolder: string;
  chromeWebSecurity: boolean;
}

export interface NxComponentTestingOptions {
  /**
   * the component testing target name.
   * this is only when customized away from the default value of `component-test`
   * @example 'component-test'
   */
  ctTargetName?: string;
  bundler?: 'vite' | 'webpack';
  compiler?: 'swc' | 'babel';
}

export function nxBaseCypressPreset(
  pathToConfig: string,
  options?: { testingType: 'component' | 'e2e' }
): BaseCypressPreset {
  // used to set babel settings for react CT.
  process.env.NX_CYPRESS_COMPONENT_TEST =
    options?.testingType === 'component' ? 'true' : 'false';
  // prevent from placing path outside the root of the workspace
  // if they pass in a file or directory
  const normalizedPath = lstatSync(pathToConfig).isDirectory()
    ? pathToConfig
    : dirname(pathToConfig);
  const projectPath = relative(workspaceRoot, normalizedPath);
  const offset = relative(normalizedPath, workspaceRoot);
  const videosFolder = join(offset, 'dist', 'cypress', projectPath, 'videos');
  const screenshotsFolder = join(
    offset,
    'dist',
    'cypress',
    projectPath,
    'screenshots'
  );

  return {
    videosFolder,
    screenshotsFolder,
    chromeWebSecurity: false,
  };
}

/**
 * nx E2E Preset for Cypress
 * @description
 * this preset contains the base configuration
 * for your e2e tests that nx recommends.
 * you can easily extend this within your cypress config via spreading the preset
 * @example
 * export default defineConfig({
 *   e2e: {
 *     ...nxE2EPreset(__dirname)
 *     // add your own config here
 *   }
 * })
 *
 */
export function nxE2EPreset(
  pathToConfig: string,
  options?: NxCypressE2EPresetOptions
) {
  const basePath = options?.cypressDir || 'src';
  const baseConfig: any /** Cypress.EndToEndConfigOptions */ = {
    ...nxBaseCypressPreset(pathToConfig),
    fileServerFolder: '.',
    supportFile: `${basePath}/support/e2e.ts`,
    specPattern: `${basePath}/**/*.cy.{js,jsx,ts,tsx}`,
    fixturesFolder: `${basePath}/fixtures`,
    env: {
      devServerTargets: options?.devServerTargets,
      devServerTargetOptions: {},
      ciDevServerTarget: options?.ciDevServerTarget,
    },
    async setupNodeEvents(on, config) {
      if (options?.bundler === 'vite') {
        on('file:preprocessor', vitePreprocessor());
      }
      if (!config.env.devServerTargets) {
        return;
      }
      const devServerTarget =
        config.env.devServerTarget ?? config.env.devServerTargets['default'];

      if (!devServerTarget) {
        return;
      }
      if (!config.baseUrl && devServerTarget) {
        const graph = await createProjectGraphAsync();
        const target = parseTargetString(devServerTarget, graph);
        const context = createExecutorContext(
          graph,
          graph.nodes[target.project].data?.targets,
          target.project,
          target.target,
          target.configuration
        );

        const devServer = startDevServer(
          {
            devServerTarget,
            ...config.env.devServerTargetOptions,
          },
          context
        );
        on('after:run', () => {
          devServer.return();
        });
        const devServerValue = (await devServer.next()).value;
        if (!devServerValue) {
          return;
        }
        return { ...config, baseUrl: devServerValue.baseUrl };
      }
    },
  };

  return baseConfig;
}

export type NxCypressE2EPresetOptions = {
  bundler?: string;
  /**
   * The directory from the project root, where the cypress files (support, fixtures, specs) are located.
   * i.e. 'cypress/' or 'src'
   * default is 'src'
   **/
  cypressDir?: string;

  devServerTargets?: Record<string, string>;
  ciDevServerTarget?: string;
};
