import { workspaceRoot } from '@nx/devkit';
import { dirname, join, relative } from 'path';
import { existsSync, lstatSync } from 'fs';

import vitePreprocessor from '../src/plugins/preprocessor-vite';
import { NX_PLUGIN_OPTIONS } from '../src/utils/constants';

import { spawn } from 'child_process';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';

// Importing the cypress type here causes the angular and next unit
// tests to fail when transpiling, it seems like the cypress types are
// clobbering jest's types. A bit weird. Leaving the commented out import
// and usage, as its helpful when modifying this code.
//
// import type * as Cypress from 'cypress';

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
  buildTarget?: string;
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

function startWebServer(webServerCommand: string) {
  const serverProcess = spawn(webServerCommand, {
    cwd: workspaceRoot,
    shell: true,
    // Detaching the process on unix will create a process group, allowing us to kill it later
    // Windows is fine so we leave it attached to this process
    detached: process.platform !== 'win32',
    stdio: 'inherit',
  });

  return () => {
    // child.kill() does not work on linux
    // process.kill will kill the whole process group on unix
    process.kill(-serverProcess.pid, 'SIGKILL');
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

  const dir = dirname(pathToConfig);
  let supportFile: undefined | string = undefined;
  for (const f of ['e2e.ts', 'e2e.js']) {
    const candidate = join(dir, basePath, 'support', f);
    if (existsSync(candidate)) {
      supportFile = candidate;
      break;
    }
  }

  const baseConfig: any /*Cypress.EndToEndConfigOptions & {
    [NX_PLUGIN_OPTIONS]: unknown;
  }*/ = {
    ...nxBaseCypressPreset(pathToConfig),
    fileServerFolder: '.',
    supportFile,
    specPattern: `${basePath}/**/*.cy.{js,jsx,ts,tsx}`,
    fixturesFolder: `${basePath}/fixtures`,

    [NX_PLUGIN_OPTIONS]: {
      webServerCommand: options?.webServerCommands?.default,
      webServerCommands: options?.webServerCommands,
      ciWebServerCommand: options?.ciWebServerCommand,
    },

    async setupNodeEvents(on, config) {
      const webServerCommands =
        config.env?.webServerCommands ?? options?.webServerCommands;
      const webServerCommand =
        config.env?.webServerCommand ?? webServerCommands?.default;

      if (options?.bundler === 'vite') {
        on('file:preprocessor', vitePreprocessor());
      }

      if (!options?.webServerCommands) {
        return;
      }

      if (!webServerCommand) {
        return;
      }
      if (config.baseUrl && webServerCommand) {
        if (await isServerUp(config.baseUrl)) {
          if (
            options?.webServerConfig?.reuseExistingServer === undefined
              ? true
              : options.webServerConfig.reuseExistingServer
          ) {
            console.log(
              `Reusing the server already running on ${config.baseUrl}`
            );
            return;
          } else {
            throw new Error(
              `Web server is already running at ${config.baseUrl}`
            );
          }
        }
        const killWebServer = startWebServer(webServerCommand);

        on('after:run', () => {
          killWebServer();
        });
        await waitForServer(config.baseUrl, options.webServerConfig);
      }
    },
  };

  return baseConfig;
}

function waitForServer(
  url: string,
  webServerConfig: WebServerConfig
): Promise<void> {
  return new Promise((resolve, reject) => {
    let pollTimeout: NodeJS.Timeout | null;
    const { protocol } = new URL(url);

    const timeoutDuration = webServerConfig?.timeout ?? 15 * 1000;
    const timeout = setTimeout(() => {
      clearTimeout(pollTimeout);
      reject(
        new Error(
          `Web server failed to start in ${timeoutDuration}ms. This can be configured in cypress.config.ts.`
        )
      );
    }, timeoutDuration);

    const makeRequest = protocol === 'https:' ? httpsRequest : httpRequest;

    function pollForServer() {
      const request = makeRequest(url, () => {
        clearTimeout(timeout);
        resolve();
      });

      request.on('error', () => {
        pollTimeout = setTimeout(pollForServer, 100);
      });

      // Don't forget to end the request
      request.end();
    }

    pollForServer();
  });
}

function isServerUp(url: string) {
  const { protocol } = new URL(url);
  const makeRequest = protocol === 'https:' ? httpsRequest : httpRequest;

  return new Promise((resolve) => {
    const request = makeRequest(url, () => {
      resolve(true);
    });

    request.on('error', () => {
      resolve(false);
    });

    // Don't forget to end the request
    request.end();
  });
}

export interface WebServerConfig {
  /**
   * Timeout to wait for the webserver to start listening
   */
  timeout?: number;
  /**
   * Reuse an existing web server if it exists
   * If this is false, an error will be thrown if the server is already running
   */
  reuseExistingServer?: boolean;
}

export type NxCypressE2EPresetOptions = {
  bundler?: string;
  /**
   * The directory from the project root, where the cypress files (support, fixtures, specs) are located.
   * i.e. 'cypress/' or 'src'
   * default is 'src'
   **/
  cypressDir?: string;

  /**
   * A map of commandName -> command to start the web server for testing.
   * Currently only default is read.
   */
  webServerCommands?: Record<string, string>;

  /**
   * A command to start the web server - used for e2e tests distributed by Nx.
   */
  ciWebServerCommand?: string;

  /**
   * Configures how the web server command is started and monitored.
   */
  webServerConfig?: WebServerConfig;
};
