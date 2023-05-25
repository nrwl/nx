import { ExecutorContext, logger } from '@nx/devkit';
import { removeSync, existsSync } from 'fs-extra';
import { ChildProcess, execSync, fork } from 'child_process';
import { VerdaccioExecutorSchema } from './schema';

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

  if (options.clear && options.storage && existsSync(options.storage)) {
    removeSync(options.storage);
  }
  const cleanupFunctions = [setupNpm(options), setupYarn(options)];

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
    await startVerdaccio(options);
  } catch (e) {
    logger.error('Failed to start verdaccio: ' + e.toString());
    return {
      success: false,
    };
  }
  return {
    success: true,
  };
}

/**
 * Fork the verdaccio process: https://verdaccio.org/docs/verdaccio-programmatically/#using-fork-from-child_process-module
 */
function startVerdaccio(options: VerdaccioExecutorSchema) {
  return new Promise((resolve, reject) => {
    childProcess = fork(
      require.resolve('verdaccio/bin/verdaccio'),
      createVerdaccioOptions(options),
      {
        env: {
          ...process.env,
          VERDACCIO_HANDLE_KILL_SIGNALS: 'true',
        },
        stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
      }
    );

    childProcess.stdout.on('data', (data) => {
      process.stdout.write(data);
    });
    childProcess.stderr.on('data', (data) => {
      if (
        data.includes('VerdaccioWarning') ||
        data.includes('DeprecationWarning')
      ) {
        process.stdout.write(data);
      } else {
        reject(data);
      }
    });
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

function createVerdaccioOptions(options: VerdaccioExecutorSchema) {
  const verdaccioArgs: string[] = [];
  if (options.port) {
    verdaccioArgs.push('--listen', options.port.toString());
  }
  if (options.config) {
    verdaccioArgs.push('--config', options.config);
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
      `npm config set //localhost:${options.port}/:_authToken="secretVerdaccioToken"`
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
    } catch (e) {
      throw new Error(`Failed to reset npm registry: ${e.message}`);
    }
  };
}

function setupYarn(options: VerdaccioExecutorSchema) {
  try {
    execSync('yarn --version');
  } catch (e) {
    return () => {};
  }

  let yarnRegistryPath;
  try {
    yarnRegistryPath = execSync(`yarn config get registry`)
      ?.toString()
      ?.trim()
      ?.replace('\u001b[2K\u001b[1G', ''); // strip out ansi codes
    execSync(`yarn config set registry http://localhost:${options.port}/`);
    logger.info(`Set yarn registry to http://localhost:${options.port}/`);
  } catch (e) {
    throw new Error(
      `Failed to set yarn registry to http://localhost:${options.port}/: ${e.message}`
    );
  }

  return () => {
    try {
      if (yarnRegistryPath) {
        execSync(`yarn config set registry ${yarnRegistryPath}`);
        logger.info(`Reset yarn registry to ${yarnRegistryPath}`);
      } else {
        execSync(`yarn config delete registry`);
      }
    } catch (e) {
      throw new Error(`Failed to reset yarn registry: ${e.message}`);
    }
  };
}

export default verdaccioExecutor;
