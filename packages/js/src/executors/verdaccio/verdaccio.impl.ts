import { ExecutorContext, logger } from '@nx/devkit';
import { ChildProcess, execSync, fork } from 'child_process';
import * as detectPort from 'detect-port';
import { existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'path';

import { VerdaccioExecutorSchema } from './schema';
import { major } from 'semver';

let childProcess: ChildProcess;

let env: NodeJS.ProcessEnv = {
  SKIP_YARN_COREPACK_CHECK: 'true',
  ...process.env,
};

/**
 * - set npm and yarn to use local registry
 * - start verdaccio
 * - stop local registry when done
 */
export async function verdaccioExecutor(
  options: VerdaccioExecutorSchema,
  context: ExecutorContext
) {
  try {
    require.resolve('verdaccio');
  } catch (e) {
    throw new Error(
      'Verdaccio is not installed. Please run `npm install verdaccio` or `yarn add verdaccio`'
    );
  }

  if (options.storage) {
    options.storage = resolve(context.root, options.storage);
    if (options.clear && existsSync(options.storage)) {
      rmSync(options.storage, { recursive: true, force: true });
      console.log(`Cleared local registry storage folder ${options.storage}`);
    }
  }

  const port = await detectPort(options.port);
  if (port !== options.port) {
    logger.info(`Port ${options.port} was occupied. Using port ${port}.`);
    options.port = port;
  }

  const cleanupFunctions =
    options.location === 'none' ? [] : [setupNpm(options), setupYarn(options)];

  const processExitListener = (signal?: number | NodeJS.Signals) => {
    if (childProcess) {
      childProcess.kill(signal);
    }
    for (const fn of cleanupFunctions) {
      fn();
    }
  };
  process.on('exit', processExitListener);
  process.on('SIGTERM', processExitListener);
  process.on('SIGINT', processExitListener);
  process.on('SIGHUP', processExitListener);

  try {
    await startVerdaccio(options, context.root);
  } catch (e) {
    logger.error('Failed to start verdaccio: ' + e?.toString());
    return {
      success: false,
      port: options.port,
    };
  }
  return {
    success: true,
    port: options.port,
  };
}

/**
 * Fork the verdaccio process: https://verdaccio.org/docs/verdaccio-programmatically/#using-fork-from-child_process-module
 */
function startVerdaccio(
  options: VerdaccioExecutorSchema,
  workspaceRoot: string
) {
  return new Promise((resolve, reject) => {
    childProcess = fork(
      require.resolve('verdaccio/bin/verdaccio'),
      createVerdaccioOptions(options, workspaceRoot),
      {
        env: {
          ...process.env,
          VERDACCIO_HANDLE_KILL_SIGNALS: 'true',
          ...(options.storage
            ? { VERDACCIO_STORAGE_PATH: options.storage }
            : {}),
        },
        stdio: 'inherit',
      }
    );

    childProcess.on('error', (err) => {
      reject(err);
    });
    childProcess.on('disconnect', (err) => {
      reject(err);
    });
    childProcess.on('exit', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(code);
      }
    });
  });
}

function createVerdaccioOptions(
  options: VerdaccioExecutorSchema,
  workspaceRoot: string
) {
  const verdaccioArgs: string[] = [];
  if (options.config) {
    verdaccioArgs.push('--config', join(workspaceRoot, options.config));
  } else {
    options.port ??= 4873; // set default port if config is not provided
  }
  if (options.port) {
    const listenAddress = options.listenAddress
      ? `${options.listenAddress}:${options.port.toString()}`
      : options.port.toString();
    verdaccioArgs.push('--listen', listenAddress);
  }
  return verdaccioArgs;
}

function setupNpm(options: VerdaccioExecutorSchema) {
  try {
    execSync('npm --version', { env, windowsHide: true });
  } catch (e) {
    return () => {};
  }

  let npmRegistryPaths: string[] = [];
  const scopes: string[] = ['', ...(options.scopes || [])];

  try {
    scopes.forEach((scope) => {
      const registryName = scope ? `${scope}:registry` : 'registry';
      try {
        npmRegistryPaths.push(
          execSync(
            `npm config get ${registryName} --location ${options.location}`,
            { env, windowsHide: true }
          )
            ?.toString()
            ?.trim()
            ?.replace('\u001b[2K\u001b[1G', '') // strip out ansi codes
        );
        execSync(
          `npm config set ${registryName} http://localhost:${options.port}/ --location ${options.location}`,
          { env, windowsHide: true }
        );

        execSync(
          `npm config set //localhost:${options.port}/:_authToken="secretVerdaccioToken" --location ${options.location}`,
          { env, windowsHide: true }
        );

        logger.info(
          `Set npm ${registryName} to http://localhost:${options.port}/`
        );
      } catch (e) {
        throw new Error(
          `Failed to set npm ${registryName} to http://localhost:${options.port}/: ${e.message}`
        );
      }
    });

    return () => {
      try {
        const currentNpmRegistryPath = execSync(
          `npm config get registry --location ${options.location}`,
          { env, windowsHide: true }
        )
          ?.toString()
          ?.trim()
          ?.replace('\u001b[2K\u001b[1G', ''); // strip out ansi codes
        scopes.forEach((scope, index) => {
          const registryName = scope ? `${scope}:registry` : 'registry';
          if (
            npmRegistryPaths[index] &&
            currentNpmRegistryPath.includes('localhost')
          ) {
            execSync(
              `npm config set ${registryName} ${npmRegistryPaths[index]} --location ${options.location}`,
              { env, windowsHide: true }
            );
            logger.info(
              `Reset npm ${registryName} to ${npmRegistryPaths[index]}`
            );
          } else {
            execSync(
              `npm config delete ${registryName} --location ${options.location}`,
              {
                env,
                windowsHide: true,
              }
            );
            logger.info('Cleared custom npm registry');
          }
        });
        execSync(
          `npm config delete //localhost:${options.port}/:_authToken  --location ${options.location}`,
          { env, windowsHide: true }
        );
      } catch (e) {
        throw new Error(`Failed to reset npm registry: ${e.message}`);
      }
    };
  } catch (e) {
    throw new Error(
      `Failed to set npm registry to http://localhost:${options.port}/: ${e.message}`
    );
  }
}

function getYarnUnsafeHttpWhitelist(isYarnV1: boolean) {
  return !isYarnV1
    ? new Set<string>(
        JSON.parse(
          execSync(`yarn config get unsafeHttpWhitelist --json`, {
            env,
            windowsHide: true,
          }).toString()
        )
      )
    : null;
}

function setYarnUnsafeHttpWhitelist(
  currentWhitelist: Set<string>,
  options: VerdaccioExecutorSchema
) {
  if (currentWhitelist.size > 0) {
    execSync(
      `yarn config set unsafeHttpWhitelist --json '${JSON.stringify(
        Array.from(currentWhitelist)
      )}'` + (options.location === 'user' ? ' --home' : ''),
      { env, windowsHide: true }
    );
  } else {
    execSync(
      `yarn config unset unsafeHttpWhitelist` +
        (options.location === 'user' ? ' --home' : ''),
      { env, windowsHide: true }
    );
  }
}

function setupYarn(options: VerdaccioExecutorSchema) {
  let isYarnV1;
  let yarnRegistryPaths: string[] = [];
  const scopes: string[] = ['', ...(options.scopes || [])];

  try {
    isYarnV1 =
      major(
        execSync('yarn --version', { env, windowsHide: true }).toString().trim()
      ) === 1;
  } catch {
    // This would fail if yarn is not installed which is okay
    return () => {};
  }
  try {
    const registryConfigName = isYarnV1 ? 'registry' : 'npmRegistryServer';

    scopes.forEach((scope) => {
      const scopeName = scope ? `${scope}:` : '';

      yarnRegistryPaths.push(
        execSync(`yarn config get ${scopeName}${registryConfigName}`, {
          env,
          windowsHide: true,
        })
          ?.toString()
          ?.trim()
          ?.replace('\u001b[2K\u001b[1G', '') // strip out ansi codes
      );

      execSync(
        `yarn config set ${scopeName}${registryConfigName} http://localhost:${options.port}/` +
          (options.location === 'user' ? ' --home' : ''),
        { env, windowsHide: true }
      );

      logger.info(
        `Set yarn ${scopeName}registry to http://localhost:${options.port}/`
      );
    });

    const currentWhitelist: Set<string> | null =
      getYarnUnsafeHttpWhitelist(isYarnV1);

    let whitelistedLocalhost = false;

    if (!isYarnV1 && !currentWhitelist.has('localhost')) {
      whitelistedLocalhost = true;
      currentWhitelist.add('localhost');

      setYarnUnsafeHttpWhitelist(currentWhitelist, options);
      logger.info(
        `Whitelisted http://localhost:${options.port}/ as an unsafe http server`
      );
    }

    return () => {
      try {
        const currentYarnRegistryPath = execSync(
          `yarn config get ${registryConfigName}`,
          { env, windowsHide: true }
        )
          ?.toString()
          ?.trim()
          ?.replace('\u001b[2K\u001b[1G', ''); // strip out ansi codes

        scopes.forEach((scope, index) => {
          const registryName = scope
            ? `${scope}:${registryConfigName}`
            : registryConfigName;

          if (
            yarnRegistryPaths[index] &&
            currentYarnRegistryPath.includes('localhost')
          ) {
            execSync(
              `yarn config set ${registryName} ${yarnRegistryPaths[index]}` +
                (options.location === 'user' ? ' --home' : ''),
              {
                env,

                windowsHide: true,
              }
            );
            logger.info(
              `Reset yarn ${registryName} to ${yarnRegistryPaths[index]}`
            );
          } else {
            execSync(
              `yarn config ${isYarnV1 ? 'delete' : 'unset'} ${registryName}` +
                (options.location === 'user' ? ' --home' : ''),
              { env, windowsHide: true }
            );
            logger.info(`Cleared custom yarn ${registryConfigName}`);
          }
        });
        if (whitelistedLocalhost) {
          const currentWhitelist: Set<string> =
            getYarnUnsafeHttpWhitelist(isYarnV1);

          if (currentWhitelist.has('localhost')) {
            currentWhitelist.delete('localhost');

            setYarnUnsafeHttpWhitelist(currentWhitelist, options);
            logger.info(
              `Removed http://localhost:${options.port}/ as an unsafe http server`
            );
          }
        }
      } catch (e) {
        throw new Error(`Failed to reset yarn registry: ${e.message}`);
      }
    };
  } catch (e) {
    throw new Error(
      `Failed to set yarn registry to http://localhost:${options.port}/: ${e.message}`
    );
  }
}

export default verdaccioExecutor;
