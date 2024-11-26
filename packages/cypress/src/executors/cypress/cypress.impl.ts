import { ExecutorContext, logger, stripIndents } from '@nx/devkit';
import { existsSync, readdirSync, unlinkSync } from 'fs';
import { basename, dirname } from 'path';
import { getTempTailwindPath } from '../../utils/ct-helpers';
import { installedCypressVersion } from '../../utils/cypress-version';
import { startDevServer } from '../../utils/start-dev-server';

const Cypress = require('cypress'); // @NOTE: Importing via ES6 messes the whole test dependencies.

export type Json = { [k: string]: any };

export interface CypressExecutorOptions extends Json {
  cypressConfig: string;
  watch?: boolean;
  devServerTarget?: string;
  headed?: boolean;
  /**
   * @deprecated use watch instead
   **/
  headless?: boolean;
  exit?: boolean;
  key?: string;
  record?: boolean;
  parallel?: boolean;
  baseUrl?: string;
  browser?: string;
  env?: Record<string, string>;
  spec?: string;
  /**
   * @deprecated no longer used since cypress supports typescript out of the box
   **/
  copyFiles?: string;
  ciBuildId?: string | number;
  group?: string;
  ignoreTestFiles?: string | string[];
  reporter?: string;
  reporterOptions?: string | Json;
  skipServe?: boolean;
  testingType?: 'component' | 'e2e';
  tag?: string;
  port?: number | 'cypress-auto';
  quiet?: boolean;
  runnerUi?: boolean;
  autoCancelAfterFailures?: boolean | number;
}

interface NormalizedCypressExecutorOptions extends CypressExecutorOptions {
  ctTailwindPath?: string;
  portLockFilePath?: string;
}

export default async function cypressExecutor(
  options: CypressExecutorOptions,
  context: ExecutorContext
) {
  options = normalizeOptions(options, context);
  // this is used by cypress component testing presets to build the executor contexts with the correct configuration options.
  process.env.NX_CYPRESS_TARGET_CONFIGURATION = context.configurationName;
  let success;

  for await (const devServerValues of startDevServer(options, context)) {
    try {
      success = await runCypress(devServerValues.baseUrl, {
        ...options,
        portLockFilePath: devServerValues.portLockFilePath,
      });
      if (!options.watch) break;
    } catch (e) {
      logger.error(e.message);
      success = false;
      if (!options.watch) break;
    }
  }

  return { success };
}

function normalizeOptions(
  options: CypressExecutorOptions,
  context: ExecutorContext
): NormalizedCypressExecutorOptions {
  options.env = options.env || {};
  if (options.testingType === 'component') {
    const project = context?.projectGraph?.nodes?.[context.projectName];
    if (project?.data?.root) {
      options.ctTailwindPath = getTempTailwindPath(context);
    }
  }
  checkSupportedBrowser(options);
  warnDeprecatedHeadless(options);
  warnDeprecatedCypressVersion();
  return options;
}

function checkSupportedBrowser({ browser }: CypressExecutorOptions) {
  // Browser was not passed in as an option, cypress will use whatever default it has set and we dont need to check it
  if (!browser) {
    return;
  }

  if (installedCypressVersion() >= 4 && browser == 'canary') {
    logger.warn(stripIndents`
  Warning:
  You are using a browser that is not supported by cypress v4+.

  Read here for more info:
  https://docs.cypress.io/guides/references/migration-guide.html#Launching-Chrome-Canary-with-browser
  `);
    return;
  }

  const supportedV3Browsers = ['electron', 'chrome', 'canary', 'chromium'];
  if (
    installedCypressVersion() <= 3 &&
    !supportedV3Browsers.includes(browser)
  ) {
    logger.warn(stripIndents`
    Warning:
    You are using a browser that is not supported by cypress v3.
    `);
    return;
  }
}

function warnDeprecatedHeadless({ headless }: CypressExecutorOptions) {
  if (installedCypressVersion() < 8 || headless === undefined) {
    return;
  }

  if (headless) {
    const deprecatedMsg = stripIndents`
    NOTE:
    You can now remove the use of the '--headless' flag during 'cypress run' as this is the default for all browsers.`;

    logger.warn(deprecatedMsg);
  }
}

function warnDeprecatedCypressVersion() {
  if (installedCypressVersion() < 10) {
    logger.warn(stripIndents`
NOTE:
Support for Cypress versions < 10 is deprecated. Please upgrade to at least Cypress version 10.
A generator to migrate from v8 to v10 is provided. See https://nx.dev/cypress/v10-migration-guide
`);
  }
}

/**
 * @whatItDoes Initialize the Cypress test runner with the provided project configuration.
 * By default, Cypress will run tests from the CLI without the GUI and provide directly the results in the console output.
 * If `watch` is `true`: Open Cypress in the interactive GUI to interact directly with the application.
 */
async function runCypress(
  baseUrl: string,
  opts: NormalizedCypressExecutorOptions
) {
  const cypressVersion = installedCypressVersion();
  // Cypress expects the folder where a cypress config is present
  const projectFolderPath = dirname(opts.cypressConfig);
  const options: any = {
    project: projectFolderPath,
    configFile: basename(opts.cypressConfig),
  };
  // If not, will use the `baseUrl` normally from `cypress.json`
  if (baseUrl) {
    options.config = { baseUrl };
  }

  if (opts.browser) {
    options.browser = opts.browser;
  }

  if (opts.env) {
    options.env = {
      ...options.env,
      ...opts.env,
    };
  }
  if (opts.spec) {
    options.spec = opts.spec;
  }

  options.tag = opts.tag;
  options.exit = opts.exit;
  options.headed = opts.headed;
  options.runnerUi = opts.runnerUi;

  if (opts.headless) {
    options.headless = opts.headless;
  }

  options.record = opts.record;
  options.key = opts.key;
  options.parallel = opts.parallel;
  options.ciBuildId = opts.ciBuildId?.toString();
  options.group = opts.group;
  // renamed in cy 10
  if (cypressVersion >= 10) {
    options.config ??= {};
    options.config[opts.testingType] = {
      excludeSpecPattern: opts.ignoreTestFiles,
    };
  } else {
    options.ignoreTestFiles = opts.ignoreTestFiles;
  }

  if (opts.reporter) {
    options.reporter = opts.reporter;
  }

  if (opts.reporterOptions) {
    options.reporterOptions = opts.reporterOptions;
  }
  if (opts.quiet) {
    options.quiet = opts.quiet;
  }

  if (opts.autoCancelAfterFailures !== undefined) {
    options.autoCancelAfterFailures = opts.autoCancelAfterFailures;
  }

  options.testingType = opts.testingType;

  const result = await (opts.watch
    ? Cypress.open(options)
    : Cypress.run(options));

  cleanupTmpFile(opts.ctTailwindPath);
  cleanupTmpFile(opts.portLockFilePath);

  if (process.env.NX_VERBOSE_LOGGING === 'true' && opts.portLockFilePath) {
    readdirSync(dirname(opts.portLockFilePath)).forEach((f) => {
      if (f.endsWith('.txt')) {
        logger.debug(`Lock file ${f} still present`);
      }
    });
  }

  /**
   * `cypress.open` is returning `0` and is not of the same type as `cypress.run`.
   * `cypress.open` is the graphical UI, so it will be obvious to know what wasn't
   * working. Forcing the build to success when `cypress.open` is used.
   */
  return !result.totalFailed && !result.failures;
}

function cleanupTmpFile(path: string) {
  try {
    if (path && existsSync(path)) {
      unlinkSync(path);
    }
    return true;
  } catch (err) {
    return false;
  }
}
