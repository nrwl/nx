import { basename, dirname, join } from 'path';
import { installedCypressVersion } from '../../utils/cypress-version';
import {
  ExecutorContext,
  logger,
  parseTargetString,
  runExecutor,
  stripIndents,
} from '@nrwl/devkit';

const Cypress = require('cypress'); // @NOTE: Importing via ES6 messes the whole test dependencies.

export type Json = { [k: string]: any };

export interface CypressExecutorOptions extends Json {
  baseUrl: string;
  cypressConfig: string;
  devServerTarget: string;
  headless: boolean;
  exit: boolean;
  parallel: boolean;
  record: boolean;
  key?: string;
  tsConfig: string;
  watch: boolean;
  browser?: string;
  env?: Record<string, string>;
  spec?: string;
  copyFiles?: string;
  ciBuildId?: string;
  group?: string;
  ignoreTestFiles?: string;
  reporter?: string;
  reporterOptions?: string;
  skipServe: boolean;
}

try {
  require('dotenv').config();
} catch (e) {}

export default async function cypressExecutor(
  options: CypressExecutorOptions,
  context: ExecutorContext
) {
  options = normalizeOptions(options, context);

  let success;
  for await (const baseUrl of startDevServer(options, context)) {
    try {
      success = await runCypress(baseUrl, options);
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
) {
  options.env = options.env || {};
  if (options.tsConfig) {
    options.env.tsConfig = join(context.root, options.tsConfig);
  }
  checkSupportedBrowser(options);
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

async function* startDevServer(
  opts: CypressExecutorOptions,
  context: ExecutorContext
) {
  // no dev server, return the provisioned base url
  if (!opts.devServerTarget || opts.skipServe) {
    yield opts.baseUrl;
    return;
  }

  console.log('VALUE....', parseTargetString(opts.devServerTarget));

  const { project, target, configuration } = parseTargetString(
    opts.devServerTarget
  );
  for await (const output of await runExecutor<{
    success: boolean;
    baseUrl?: string;
  }>(
    { project, target, configuration },
    {
      watch: opts.watch,
    },
    context
  )) {
    if (!output.success && !opts.watch)
      throw new Error('Could not compile application files');
    yield opts.baseUrl || (output.baseUrl as string);
  }
}

/**
 * @whatItDoes Initialize the Cypress test runner with the provided project configuration.
 * If `headless` is `false`: open the Cypress application, the user will
 * be able to interact directly with the application.
 * If `headless` is `true`: Cypress will run in headless mode and will
 * provide directly the results in the console output.
 */
async function runCypress(baseUrl: string, opts: CypressExecutorOptions) {
  // Cypress expects the folder where a `cypress.json` is present
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
    options.env = opts.env;
  }
  if (opts.spec) {
    options.spec = opts.spec;
  }

  options.exit = opts.exit;
  options.headed = !opts.headless;
  options.headless = opts.headless;
  options.record = opts.record;
  options.key = opts.key;
  options.parallel = opts.parallel;
  options.ciBuildId = opts.ciBuildId;
  options.group = opts.group;
  options.ignoreTestFiles = opts.ignoreTestFiles;
  options.reporter = opts.reporter;
  options.reporterOptions = opts.reporterOptions;

  const result = await (!opts.watch || opts.headless
    ? Cypress.run(options)
    : Cypress.open(options));

  /**
   * `cypress.open` is returning `0` and is not of the same type as `cypress.run`.
   * `cypress.open` is the graphical UI, so it will be obvious to know what wasn't
   * working. Forcing the build to success when `cypress.open` is used.
   */
  return !result.totalFailed && !result.failures;
}
