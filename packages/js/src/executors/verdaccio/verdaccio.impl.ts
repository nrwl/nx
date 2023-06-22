import { ExecutorContext, logger } from '@nx/devkit';
import { existsSync, rmSync } from 'fs-extra';
import { ChildProcess, execSync, fork } from 'child_process';
import * as detectPort from 'detect-port';
import { join, resolve } from 'path';

import { VerdaccioExecutorSchema } from './schema';
import { major } from 'semver';

let childProcess: ChildProcess;

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
  if (options.port) {
    verdaccioArgs.push('--listen', options.port.toString());
  }
  if (options.config) {
    verdaccioArgs.push('--config', join(workspaceRoot, options.config));
  }
  return verdaccioArgs;
}

function setupNpm(options: VerdaccioExecutorSchema) {
  try {
    execSync('npm --version');
  } catch (e) {
    return () => {};
  }

  let npmRegistryPath;
  try {
    npmRegistryPath = execSync(
      `npm config get registry --location ${options.location}`
    )
      ?.toString()
      ?.trim()
      ?.replace('\u001b[2K\u001b[1G', ''); // strip out ansi codes
    execSync(
      `npm config set registry http://localhost:${options.port}/ --location ${options.location}`
    );
    execSync(
      `npm config set //localhost:${options.port}/:_authToken="secretVerdaccioToken" --location ${options.location}`
    );
    logger.info(`Set npm registry to http://localhost:${options.port}/`);
  } catch (e) {
    throw new Error(
      `Failed to set npm registry to http://localhost:${options.port}/: ${e.message}`
    );
  }

  return () => {
    try {
      if (npmRegistryPath) {
        execSync(
          `npm config set registry ${npmRegistryPath} --location ${options.location}`
        );
        logger.info(`Reset npm registry to ${npmRegistryPath}`);
      } else {
        execSync(`npm config delete registry --location ${options.location}`);
      }
      execSync(
        `npm config delete //localhost:${options.port}/:_authToken  --location ${options.location}`
      );
    } catch (e) {
      throw new Error(`Failed to reset npm registry: ${e.message}`);
    }
  };
}

function getYarnUnsafeHttpWhitelist(isYarnV1: boolean) {
  return !isYarnV1
    ? new Set<string>(
        JSON.parse(
          execSync(`yarn config get unsafeHttpWhitelist --json`).toString()
        )
      )
    : null;
}

function setYarnUnsafeHttpWhitelist(
  currentWhitelist: Set<string>,
  options: VerdaccioExecutorSchema
) {
  if (currentWhitelist.size > 1) {
    execSync(
      `yarn config set unsafeHttpWhitelist --json '${JSON.stringify(
        Array.from(currentWhitelist)
      )}'` + (options.location === 'user' ? ' --home' : '')
    );
  } else {
    execSync(
      `yarn config unset unsafeHttpWhitelist` +
        (options.location === 'user' ? ' --home' : '')
    );
  }
}

function setupYarn(options: VerdaccioExecutorSchema) {
  let isYarnV1;

  try {
    isYarnV1 = major(execSync('yarn --version').toString().trim()) === 1;
  } catch {
    // This would fail if yarn is not installed which is okay
    return () => {};
  }
  try {
    const registryConfigName = isYarnV1 ? 'registry' : 'npmRegistryServer';

    const yarnRegistryPath = execSync(`yarn config get ${registryConfigName}`)
      ?.toString()
      ?.trim()
      ?.replace('\u001b[2K\u001b[1G', ''); // strip out ansi codes

    execSync(
      `yarn config set ${registryConfigName} http://localhost:${options.port}/` +
        (options.location === 'user' ? ' --home' : '')
    );

    logger.info(`Set yarn registry to http://localhost:${options.port}/`);

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
        if (yarnRegistryPath) {
          execSync(
            `yarn config set ${registryConfigName} ${yarnRegistryPath}` +
              (options.location === 'user' ? ' --home' : '')
          );
          logger.info(
            `Reset yarn ${registryConfigName} to ${yarnRegistryPath}`
          );
        } else {
          execSync(
            `yarn config ${
              isYarnV1 ? 'delete' : 'unset'
            } ${registryConfigName}` +
              (options.location === 'user' ? ' --home' : '')
          );
        }

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
