import { workspaceRoot } from '@nx/devkit';
import { dirname, join, relative } from 'path';
import { lstatSync } from 'fs';

import vitePreprocessor from '../src/plugins/preprocessor-vite';
import parseArgsStringToArgv from 'string-argv';
import { spawn } from 'child_process';

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
      webServerCommands: options?.webServerCommands,
      ciWebServerCommand: options?.ciWebServerCommand,
    },
    async setupNodeEvents(on, config) {
      if (options?.bundler === 'vite') {
        on('file:preprocessor', vitePreprocessor());
      }
      if (!config.env.webServerCommands) {
        return;
      }
      const webServerCommand =
        config.env.webServerCommand ?? config.env.webServerCommands.default;

      if (!webServerCommand) {
        return;
      }
      if (!config.baseUrl && webServerCommand) {
        return new Promise((resolve) => {
          const [command, ...args] = parseArgsStringToArgv(webServerCommand);
          const serverProcess = spawn(command, args, {
            stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
            cwd: workspaceRoot,
            // Shell is required for windows but cannot be true on linux because it interferes with terminating the process
            shell: process.platform === 'win32',
            windowsHide: true,
          });

          serverProcess.on('message', (message) => {
            if (
              typeof message === 'object' &&
              'type' in message &&
              'baseUrl' in message &&
              message.type === 'server'
            ) {
              config.baseUrl = message.baseUrl;
              resolve(config);
            }
          });
          on('after:run', () => {
            serverProcess.kill('SIGTERM');
          });
        });
      }
      return config;
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

  webServerCommands?: Record<string, string>;
  ciWebServerCommand?: string;
};
