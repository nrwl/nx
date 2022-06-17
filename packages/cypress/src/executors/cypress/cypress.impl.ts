import {
  ExecutorContext,
  logger,
  parseTargetString,
  readTargetOptions,
  runExecutor,
  stripIndents,
} from '@nrwl/devkit';
import 'dotenv/config';
import { basename, dirname, join } from 'path';
import { installedCypressVersion } from '../../utils/cypress-version';

const Cypress = require('cypress'); // @NOTE: Importing via ES6 messes the whole test dependencies.

export type Json = { [k: string]: any };

export interface CypressExecutorOptions extends Json {
  cypressConfig: string;
  watch?: boolean;
  tsConfig?: string;
  devServerTarget?: string;
  headed?: boolean;
  headless?: boolean;
  exit?: boolean;
  key?: string;
  record?: boolean;
  parallel?: boolean;
  baseUrl?: string;
  browser?: string;
  env?: Record<string, string>;
  spec?: string;
  copyFiles?: string;
  ciBuildId?: string | number;
  group?: string;
  ignoreTestFiles?: string;
  reporter?: string;
  reporterOptions?: string;
  skipServe?: boolean;
  testingType?: 'component' | 'e2e';
  tag?: string;
}

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
    const tsConfigPath = join(context.root, options.tsConfig);
    options.env.tsConfig = tsConfigPath;
    process.env.TS_NODE_PROJECT = tsConfigPath;
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

async function* startDevServer(
  opts: CypressExecutorOptions,
  context: ExecutorContext
) {
  // no dev server, return the provisioned base url
  if (!opts.devServerTarget || opts.skipServe) {
    yield opts.baseUrl;
    return;
  }

  const { project, target, configuration } = parseTargetString(
    opts.devServerTarget
  );
  const devServerTargetOpts = readTargetOptions(
    { project, target, configuration },
    context
  );
  const targetSupportsWatchOpt =
    Object.keys(devServerTargetOpts).includes('watch');

  for await (const output of await runExecutor<{
    success: boolean;
    baseUrl?: string;
  }>(
    { project, target, configuration },
    // @NOTE: Do not forward watch option if not supported by the target dev server,
    // this is relevant for running Cypress against dev server target that does not support this option,
    // for instance @nguniversal/builders:ssr-dev-server.
    targetSupportsWatchOpt ? { watch: opts.watch } : {},
    context
  )) {
    if (!output.success && !opts.watch)
      throw new Error('Could not compile application files');
    yield opts.baseUrl || (output.baseUrl as string);
  }
}

/**
 * @whatItDoes Initialize the Cypress test runner with the provided project configuration.
 * By default, Cypress will run tests from the CLI without the GUI and provide directly the results in the console output.
 * If `watch` is `true`: Open Cypress in the interactive GUI to interact directly with the application.
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

  options.tag = opts.tag;
  options.exit = opts.exit;
  options.headed = opts.headed;

  if (opts.headless) {
    options.headless = opts.headless;
  }

  options.record = opts.record;
  options.key = opts.key;
  options.parallel = opts.parallel;
  options.ciBuildId = opts.ciBuildId?.toString();
  options.group = opts.group;
  options.ignoreTestFiles = opts.ignoreTestFiles;

  if (opts.reporter) {
    options.reporter = opts.reporter;
  }

  if (opts.reporterOptions) {
    options.reporterOptions = opts.reporterOptions;
  }

  options.testingType = opts.testingType;

  const result = await (opts.watch
    ? Cypress.open(options)
    : Cypress.run(options));

  /**
   * `cypress.open` is returning `0` and is not of the same type as `cypress.run`.
   * `cypress.open` is the graphical UI, so it will be obvious to know what wasn't
   * working. Forcing the build to success when `cypress.open` is used.
   */
  return !result.totalFailed && !result.failures;
}
