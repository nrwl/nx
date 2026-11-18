import { getReadyUrl, workspaceRoot } from '@nx/devkit';
import { isUsingTsSolutionSetup } from '@nx/js/internal';
import { execSync, spawn } from 'child_process';
import { lstatSync } from 'fs';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
// TODO(jack): Remove this when @nx/cypress switches to moduleResolution:
// "nodenext". Vite 8 ships ESM-only type declarations (.d.mts) which are not
// resolvable under moduleResolution: "node".
type InlineConfig = Record<string, any>;
import vitePreprocessor from '../src/plugins/preprocessor-vite';
import { NX_PLUGIN_OPTIONS } from '../src/utils/constants';
const treeKill = require('tree-kill');

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

// The bundler is only used while generating the component testing configuration
// It cannot be changed after the configuration is generated
export interface NxComponentTestingPresetOptions extends Omit<
  NxComponentTestingOptions,
  'bundler'
> {}

export function nxBaseCypressPreset(
  pathToConfig: string,
  options?: { testingType: 'component' | 'e2e' }
): BaseCypressPreset {
  // used to set babel settings for react CT.
  process.env.NX_CYPRESS_COMPONENT_TEST =
    options?.testingType === 'component' ? 'true' : 'false';
  // ESM-shape configs pass `import.meta.url` (a `file://...` URL string) so
  // the same expression works under both Node's native TS strip (ESM,
  // import.meta.url defined) and Cypress's bundled tsx CJS loader, which
  // exposes `import.meta.url` but not `import.meta.dirname`. CJS-shape
  // configs still pass `__filename` directly. Normalize either form to a
  // filesystem path before stat-checking.
  const resolvedPath = pathToConfig?.startsWith('file://')
    ? fileURLToPath(pathToConfig)
    : pathToConfig;
  // prevent from placing path outside the root of the workspace
  // if they pass in a file or directory
  const normalizedPath = lstatSync(resolvedPath).isDirectory()
    ? resolvedPath
    : dirname(resolvedPath);
  const projectPath = relative(workspaceRoot, normalizedPath);
  const offset = relative(normalizedPath, workspaceRoot);
  const isTsSolutionSetup = isUsingTsSolutionSetup();
  const videosFolder = isTsSolutionSetup
    ? join('test-output', 'cypress', 'videos')
    : join(offset, 'dist', 'cypress', projectPath, 'videos');
  const screenshotsFolder = isTsSolutionSetup
    ? join('test-output', 'cypress', 'screenshots')
    : join(offset, 'dist', 'cypress', projectPath, 'screenshots');

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
    windowsHide: true,
  });

  return async () => {
    if (process.platform === 'win32') {
      try {
        execSync('taskkill /pid ' + serverProcess.pid + ' /T /F', {
          windowsHide: true,
        });
      } catch (e) {
        if (process.env.NX_VERBOSE_LOGGING === 'true') {
          console.error(e);
        }
      }
    } else {
      return new Promise<void>((res, rej) => {
        if (process.platform === 'win32' || process.platform === 'darwin') {
          if (serverProcess.kill()) {
            res();
          } else {
            rej('Unable to kill process');
          }
        } else {
          treeKill(serverProcess.pid, (err) => {
            if (err) {
              rej(err);
            }
            res();
          });
        }
      });
    }
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

  const baseConfig: any /*Cypress.EndToEndConfigOptions & {
    [NX_PLUGIN_OPTIONS]: unknown;
  }*/ = {
    ...nxBaseCypressPreset(pathToConfig),
    fileServerFolder: '.',
    supportFile: `${basePath}/support/e2e.{js,ts}`,
    specPattern: `${basePath}/**/*.cy.{js,jsx,ts,tsx}`,
    fixturesFolder: `${basePath}/fixtures`,

    [NX_PLUGIN_OPTIONS]: {
      webServerCommand: options?.webServerCommands?.default,
      webServerCommands: options?.webServerCommands,
      ciWebServerCommand: options?.ciWebServerCommand,
      ciBaseUrl: options?.ciBaseUrl,
      reuseExistingServer: options?.webServerConfig?.reuseExistingServer,
    },

    async setupNodeEvents(on, config) {
      const webServerCommands =
        config.env?.webServerCommands ?? options?.webServerCommands;
      const webServerCommand =
        config.env?.webServerCommand ?? webServerCommands?.default;

      if (options?.bundler === 'vite') {
        on('file:preprocessor', vitePreprocessor(options?.viteConfigOverrides));
      }

      // Set by Nx when the web server task already reported it is ready
      const readyUrl = process.env.NX_READY_URL;
      if (readyUrl && isBaseUrlOverridden(config, options)) {
        console.log(
          `Testing against ${config.baseUrl} from --config or CYPRESS_BASE_URL, not the server Nx started on ${readyUrl}`
        );
        await waitForServer(
          config.baseUrl,
          options?.webServerConfig,
          (ms) =>
            `${config.baseUrl} did not respond within ${ms}ms. This can be configured in cypress.config.ts.`
        );
        return;
      }
      if (readyUrl) {
        config.baseUrl = getReadyUrl(config.baseUrl);
        console.log(
          `Testing against the server Nx started on ${config.baseUrl}`
        );
        // Cypress only applies config changes returned from setupNodeEvents.
        return config;
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
          return killWebServer();
        });
        await waitForServer(config.baseUrl, options.webServerConfig);
      }
    },
  };

  return baseConfig;
}

// Cypress keeps the config file's values in rawJson, without --config, and
// reports CYPRESS_BASE_URL as from 'env'. A config file that reads
// CYPRESS_BASE_URL has it in rawJson too. Inferred CI targets pass ciBaseUrl.
function isBaseUrlOverridden(
  config: any,
  options: NxCypressE2EPresetOptions | undefined
) {
  if (!config.baseUrl) {
    return false;
  }
  if (config.resolved?.baseUrl?.from === 'env') {
    return true;
  }
  const isInferredCiTarget =
    !!options?.ciWebServerCommand &&
    config.env?.webServerCommand === options.ciWebServerCommand;
  return (
    !isSameUrl(config.baseUrl, config.rawJson?.e2e?.baseUrl) &&
    !(isInferredCiTarget && isSameUrl(config.baseUrl, options.ciBaseUrl))
  );
}

function isSameUrl(url: string, other: unknown) {
  if (typeof other !== 'string') {
    return false;
  }
  try {
    return new URL(url).href === new URL(other).href;
  } catch {
    return url === other;
  }
}

function waitForServer(
  url: string,
  webServerConfig: WebServerConfig,
  timeoutMessage = (ms: number) =>
    `Web server failed to start in ${ms}ms. This can be configured in cypress.config.ts.`
): Promise<void> {
  return new Promise((resolve, reject) => {
    let pollTimeout: NodeJS.Timeout | null;
    const { protocol } = new URL(url);

    let settled = false;
    const timeoutDuration = webServerConfig?.timeout ?? 60 * 1000;
    const timeout = setTimeout(() => {
      settled = true;
      clearTimeout(pollTimeout);
      reject(new Error(timeoutMessage(timeoutDuration)));
    }, timeoutDuration);

    const makeRequest = protocol === 'https:' ? httpsRequest : httpRequest;

    function pollForServer() {
      const request = makeRequest(url, () => {
        settled = true;
        clearTimeout(timeout);
        resolve();
      });

      request.on('error', () => {
        if (!settled) {
          pollTimeout = setTimeout(pollForServer, 100);
        }
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
   * The url of the web server for ciWebServerCommand
   */
  ciBaseUrl?: string;

  /**
   * Configures how the web server command is started and monitored.
   */
  webServerConfig?: WebServerConfig;

  /**
   * Configure override inside the vite config
   */
  viteConfigOverrides?: InlineConfig;
};
