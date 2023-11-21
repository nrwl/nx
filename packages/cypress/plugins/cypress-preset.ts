import { workspaceRoot } from '@nx/devkit';
import { dirname, join, relative } from 'path';
import { lstatSync } from 'fs';

import vitePreprocessor from '../src/plugins/preprocessor-vite';
import parseArgsStringToArgv from 'string-argv';
import { exec, spawn } from 'child_process';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';

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

function startWebServer(webServerCommand: string) {
  const serverProcess = exec(webServerCommand, {
    cwd: workspaceRoot,
  });
  serverProcess.stdout.pipe(process.stdout);
  serverProcess.stderr.pipe(process.stderr);

  return () => {
    serverProcess.kill();
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
      const webServerCommand = config.env.webServerCommand;

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

    const timeoutDuration = webServerConfig?.timeout ?? 5 * 1000;
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

  webServerCommands?: Record<string, string>;
  ciWebServerCommand?: string;
  webServerConfig?: WebServerConfig;
};
