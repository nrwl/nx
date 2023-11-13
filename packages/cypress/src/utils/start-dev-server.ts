import {
  ExecutorContext,
  logger,
  output,
  parseTargetString,
  readTargetOptions,
  runExecutor,
  stripIndents,
  Target,
  targetToTargetString,
} from '@nx/devkit';
import { join } from 'path';
import { CypressExecutorOptions } from '../executors/cypress/cypress.impl';
import * as detectPort from 'detect-port';
import { getExecutorInformation } from 'nx/src/command-line/run/executor-utils';
import { existsSync, writeFileSync } from 'fs';

export async function* startDevServer(
  opts: Omit<CypressExecutorOptions, 'cypressConfig'>,
  context: ExecutorContext
) {
  // no dev server, return the provisioned base url
  if (!opts.devServerTarget || opts.skipServe) {
    yield { baseUrl: opts.baseUrl };
    return;
  }

  const parsedDevServerTarget = parseTargetString(
    opts.devServerTarget,
    context
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
    port?: string;
    info?: { port: number; baseUrl?: string };
  }>(parsedDevServerTarget, overrides, context)) {
    if (!output.success && !opts.watch)
      throw new Error('Could not compile application files');
    if (
      !opts.baseUrl &&
      !output.baseUrl &&
      !output.info?.baseUrl &&
      (output.port || output.info?.port)
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

    const [collection, executor] = targetConfig.executor.split(':');
    const { schema } = getExecutorInformation(
      collection,
      executor,
      context.root,
      context.projectsConfigurations.projects
    );

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
