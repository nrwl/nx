import {
  ExecutorContext,
  logger,
  parseTargetString,
  readTargetOptions,
  runExecutor,
  stripIndents,
  Workspaces,
  Target,
  targetToTargetString,
  output,
} from '@nx/devkit';
import 'dotenv/config';
import { existsSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import { getTempTailwindPath } from '../../utils/ct-helpers';
import { installedCypressVersion } from '../../utils/cypress-version';
import * as detectPort from 'detect-port';

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
  ignoreTestFiles?: string;
  reporter?: string;
  reporterOptions?: string | Json;
  skipServe?: boolean;
  testingType?: 'component' | 'e2e';
  tag?: string;
  port?: number | 'cypress-auto';
  quiet?: boolean;
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

async function* startDevServer(
  opts: CypressExecutorOptions,
  context: ExecutorContext
) {
  // no dev server, return the provisioned base url
  if (!opts.devServerTarget || opts.skipServe) {
    yield { baseUrl: opts.baseUrl };
    return;
  }

  const parsedDevServerTarget = parseTargetString(
    opts.devServerTarget,
    context.projectGraph
  );

  const [targetSupportsWatchOpt] = getValueFromSchema(
    context,
    parsedDevServerTarget,
    'watch'
  );

  const overrides: Record<string, any> = {
    // @NOTE: Do not forward watch option if not supported by the target dev server,
    //  this is relevant for running Cypress against dev server target that does not support this option,
    //  for instance @nguniversal/builders:ssr-dev-server.
    ...(targetSupportsWatchOpt ? { watch: opts.watch } : {}),
  };

  if (opts.port === 'cypress-auto') {
    const freePort = await getPortForProject(context, parsedDevServerTarget);
    overrides['port'] = freePort;
  } else if (opts.port !== undefined) {
    overrides['port'] = opts.port;
    // zero is a special case that means any valid port so there is no reason to try to 'lock it'
    if (opts.port !== 0) {
      const didLock = attemptToLockPort(opts.port);
      if (!didLock) {
        logger.warn(
          stripIndents`${opts.port} is potentially already in use by another cypress run.
If the port is in use, try using a different port value or passing --port='cypress-auto' to find a free port.`
        );
      }
    }
  }

  for await (const output of await runExecutor<{
    success: boolean;
    baseUrl?: string;
    info?: { port: number; baseUrl?: string };
  }>(parsedDevServerTarget, overrides, context)) {
    if (!output.success && !opts.watch)
      throw new Error('Could not compile application files');
    if (
      !opts.baseUrl &&
      !output.baseUrl &&
      !output.info?.baseUrl &&
      output.info?.port
    ) {
      output.baseUrl = `http://localhost:${output.info.port}`;
    }
    yield {
      baseUrl: opts.baseUrl || output.baseUrl || output.info?.baseUrl,
      portLockFilePath:
        overrides.port && join(__dirname, `${overrides.port}.txt`),
    };
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

/**
 * try to find a free port for the project to run on
 * will return undefined if no port is found or the project doesn't have a port option
 **/
async function getPortForProject(
  context: ExecutorContext,
  target: Target,
  defaultPort = 4200
) {
  const fmtTarget = targetToTargetString(target);
  const [hasPortOpt, schemaPortValue] = getValueFromSchema(
    context,
    target,
    'port'
  );

  let freePort: number | undefined;

  if (hasPortOpt) {
    let normalizedPortValue: number;
    if (!schemaPortValue) {
      logger.info(
        `NX ${fmtTarget} did not have a defined port value, checking for free port with the default value of ${defaultPort}`
      );
      normalizedPortValue = defaultPort;
    } else {
      normalizedPortValue = Number(schemaPortValue);
    }

    if (isNaN(normalizedPortValue)) {
      output.warn({
        title: `Port Not a Number`,
        bodyLines: [
          `The port value found was not a number or can't be parsed to a number`,
          `When reading the devServerTarget (${fmtTarget}) schema, expected ${schemaPortValue} to be a number but got NaN.`,
          `Nx will use the default value of ${defaultPort} instead.`,
          `You can manually specify a port by setting the 'port' option`,
        ],
      });
      normalizedPortValue = defaultPort;
    }
    try {
      let attempts = 0;
      // make sure when this check happens in parallel,
      // we don't let the same port be used by multiple projects
      do {
        freePort = await detectPort(freePort || normalizedPortValue);
        if (attemptToLockPort(freePort)) {
          break;
        }
        attempts++;
        // increment port in case the lock file isn't cleaned up
        freePort++;
      } while (attempts < 20);

      logger.info(`NX Using port ${freePort} for ${fmtTarget}`);
    } catch (err) {
      throw new Error(
        stripIndents`Unable to find a free port for the dev server, ${fmtTarget}.
You can disable auto port detection by specifing a port or not passing a value to --port`
      );
    }
  } else {
    output.warn({
      title: `No Port Option Found`,
      bodyLines: [
        `The 'port' option is set to 'cypress-auto', but the devServerTarget (${fmtTarget}) does not have a port option.`,
        `Because of this, Nx is unable to verify the port is free before starting the dev server.`,
        `This might cause issues if the devServerTarget is trying to use a port that is already in use.`,
      ],
    });
  }

  return freePort;
}

/**
 * Check if the given target has the given property in it's options.
 * if the property is does not have a default value or is not in the actual executor options,
 * the value will be undefined even if it's in the executor schema.
 **/
function getValueFromSchema(
  context: ExecutorContext,
  target: Target,
  property: string
): [hasPropertyOpt: boolean, value?: unknown] {
  let targetOpts: any;
  try {
    targetOpts = readTargetOptions(target, context);
  } catch (e) {
    throw new Error(`Unable to read the target options for  ${targetToTargetString(
      target
    )}.
Are you sure this is a valid target?
Was trying to read the target for the property: '${property}', but got the following error: 
${e.message || e}`);
  }
  let targetHasOpt = Object.keys(targetOpts).includes(property);

  if (!targetHasOpt) {
    // NOTE: readTargetOptions doesn't apply non defaulted values, i.e. @nx/vite has a port options but is optional
    // so we double check the schema if readTargetOptions didn't return a value for the property
    const projectConfig =
      context.projectsConfigurations?.projects?.[target.project];
    const targetConfig = projectConfig.targets[target.target];

    const workspace = new Workspaces(context.root);
    const [collection, executor] = targetConfig.executor.split(':');
    const { schema } = workspace.readExecutor(collection, executor);

    // NOTE: schema won't have a default since readTargetOptions would have
    // already set that and this check wouldn't need to be made
    targetHasOpt = Object.keys(schema.properties).includes(property);
  }
  return [targetHasOpt, targetOpts[property]];
}

function attemptToLockPort(port: number): boolean {
  const portLockFilePath = join(__dirname, `${port}.txt`);
  try {
    if (existsSync(portLockFilePath)) {
      return false;
    }
    writeFileSync(portLockFilePath, 'locked');
    return true;
  } catch (err) {
    return false;
  }
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
