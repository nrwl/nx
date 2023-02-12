import { workspaceRoot } from '@nrwl/devkit';
import { dirname, join, relative } from 'path';
import { lstatSync } from 'fs';

import vitePreprocessor from '../src/plugins/preprocessor-vite';

interface BaseCypressPreset {
  videosFolder: string;
  screenshotsFolder: string;
  video: boolean;
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
}

export function nxBaseCypressPreset(pathToConfig: string): BaseCypressPreset {
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
    video: true,
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
 * @param pathToConfig will be used to construct the output paths for videos and screenshots
 */
export function nxE2EPreset(
  pathToConfig: string,
  options?: { bundler?: string }
) {
  const baseConfig = {
    ...nxBaseCypressPreset(pathToConfig),
    fileServerFolder: '.',
    supportFile: 'src/support/e2e.ts',
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
    fixturesFolder: 'src/fixtures',
  };

  if (options?.bundler === 'vite') {
    return {
      ...baseConfig,
      setupNodeEvents(on) {
        on('file:preprocessor', vitePreprocessor());
      },
    };
  }
  return baseConfig;
}
