import { ExecutorContext, logger } from '@nx/devkit';
import { existsSync, readdirSync, unlinkSync } from 'fs';
import { basename, dirname } from 'path';
import { getTempTailwindPath } from '../../utils/ct-helpers.js';
import { startDevServer } from '../../utils/start-dev-server.js';

const Cypress = require('cypress'); // @NOTE: Importing via ES6 messes the whole test dependencies.

export type Json = { [k: string]: any };

export interface CypressExecutorOptions extends Json {
  cypressConfig: string;
  watch?: boolean;
  devServerTarget?: string;
  headed?: boolean;
  /**
   * @deprecated Cypress runs headless by default. Use the --watch flag to
   * control head/headless behavior instead. It will be removed in Nx v23.
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

  const generatorInstance = startDevServer(options, context);
  for await (const devServerValues of generatorInstance) {
    try {
      success = await runCypress(devServerValues.baseUrl, {
        ...options,
        portLockFilePath: devServerValues.portLockFilePath,
      });
      if (!options.watch) {
        generatorInstance.return();
        break;
      }
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
  options.testingType ??= 'e2e';
  if (options.testingType === 'component') {
    const project = context?.projectGraph?.nodes?.[context.projectName];
    if (project?.data?.root) {
      options.ctTailwindPath = getTempTailwindPath(context);
    }
  }
  return options;
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
  options.config ??= {};
  options.config[opts.testingType] = {
    excludeSpecPattern: opts.ignoreTestFiles,
  };

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
