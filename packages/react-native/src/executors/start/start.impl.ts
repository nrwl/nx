import * as chalk from 'chalk';
import { ExecutorContext, logger } from '@nrwl/devkit';
import { ChildProcess, fork } from 'child_process';
import { join } from 'path';
import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';
import { isPackagerRunning } from './lib/is-packager-running';
import { ReactNativeStartOptions } from './schema';

export interface ReactNativeStartOutput {
  baseUrl?: string;
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* startExecutor(
  options: ReactNativeStartOptions,
  context: ExecutorContext
): AsyncGenerator<ReactNativeStartOutput> {
  const projectRoot = context.workspace.projects[context.projectName].root;
  ensureNodeModulesSymlink(context.root, projectRoot);

  try {
    const baseUrl = `http://localhost:${options.port}`;
    const appName = context.projectName;
    logger.info(chalk.cyan(`Packager is ready at ${baseUrl}`));
    logger.info(
      `Use ${chalk.bold(`nx run-android ${appName}`)} or ${chalk.bold(
        `nx run-ios ${appName}`
      )} to run the native app.`
    );

    await runCliStart(context.root, projectRoot, options);

    yield {
      baseUrl,
      success: true,
    };
  } finally {
    if (childProcess) {
      childProcess.kill();
    }
  }
}

/*
 * Starts the JS bundler and checks for "running" status before notifying
 * that packager has started.
 */
export async function runCliStart(
  workspaceRoot: string,
  projectRoot: string,
  options: ReactNativeStartOptions
): Promise<void> {
  const result = await isPackagerRunning(options.port);
  if (result === 'running') {
    logger.info('JS server already running.');
  } else if (result === 'unrecognized') {
    logger.warn('JS server not recognized.');
  } else {
    // result === 'not_running'
    logger.info('Starting JS server...');

    try {
      await startAsync(workspaceRoot, projectRoot, options);
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
): Promise<number> {
  return new Promise((resolve, reject) => {
    childProcess = fork(
      join(workspaceRoot, './node_modules/react-native/cli.js'),
      ['start', ...createStartOptions(options)],
      { cwd: join(workspaceRoot, projectRoot) }
    );

    // Ensure the child process is killed when the parent exits
    process.on('exit', () => childProcess.kill());
    process.on('SIGTERM', () => childProcess.kill());

    childProcess.on('error', (err) => {
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
