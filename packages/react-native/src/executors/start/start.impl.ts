import { ExecutorContext, logger } from '@nx/devkit';
import { ChildProcess, fork } from 'child_process';
import { resolve as pathResolve } from 'path';
import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';
import { isPackagerRunning } from './lib/is-packager-running';
import { ReactNativeStartOptions } from './schema';

export interface ReactNativeStartOutput {
  port?: number;
  success: boolean;
}

export default async function* startExecutor(
  options: ReactNativeStartOptions,
  context: ExecutorContext
): AsyncGenerator<ReactNativeStartOutput> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  ensureNodeModulesSymlink(context.root, projectRoot);

  const startProcess = await runCliStart(context.root, projectRoot, options);

  yield {
    port: options.port,
    success: true,
  };

  if (!startProcess) {
    return;
  }
  await new Promise<void>((resolve) => {
    const processExitListener = (signal?: number | NodeJS.Signals) => () => {
      startProcess.kill(signal);
      resolve();
      process.exit();
    };
    process.once('exit', (signal) => startProcess.kill(signal));
    process.once('SIGTERM', processExitListener);
    process.once('SIGINT', processExitListener);
    process.once('SIGQUIT', processExitListener);
  });
}

/*
 * Starts the JS bundler and checks for "running" status before notifying
 * that packager has started.
 */
export async function runCliStart(
  workspaceRoot: string,
  projectRoot: string,
  options: ReactNativeStartOptions
): Promise<ChildProcess> {
  const result = await isPackagerRunning(options.port);
  if (result === 'running') {
    logger.info(`JS server already running on port ${options.port}.`);
  } else if (result === 'unrecognized') {
    logger.warn('JS server not recognized.');
  } else {
    // result === 'not_running'
    logger.info('Starting JS server...');

    try {
      return await startAsync(workspaceRoot, projectRoot, options);
    } catch (error) {
      logger.error(
        `Failed to start the packager server. Error details: ${error.message}`
      );
      throw error;
    }
  }
}

function startAsync(
  workspaceRoot: string,
  projectRoot: string,
  options: ReactNativeStartOptions
): Promise<ChildProcess> {
  return new Promise<ChildProcess>((resolve, reject) => {
    const childProcess = fork(
      require.resolve('react-native/cli.js'),
      ['start', ...createStartOptions(options)],
      {
        cwd: pathResolve(workspaceRoot, projectRoot),
        env: process.env,
        stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
      }
    );

    childProcess.stdout.on('data', (data) => {
      process.stdout.write(data);
      if (data.toString().includes('reload the app')) {
        resolve(childProcess);
      }
    });
    childProcess.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    childProcess.on('error', (err) => {
      reject(err);
    });
    childProcess.on('exit', (code) => {
      if (code === 0) {
        resolve(childProcess);
      } else {
        reject(code);
      }
    });
  });
}

function createStartOptions(options) {
  return Object.keys(options).reduce((acc, k) => {
    if (k === 'resetCache') {
      if (options[k] === true) {
        acc.push(`--reset-cache`);
      }
    } else if (k === 'interactive') {
      if (options[k] === false) {
        acc.push(`--no-interactive`);
      }
    } else {
      acc.push(`--${k}`, options[k]);
    }
    return acc;
  }, []);
}
