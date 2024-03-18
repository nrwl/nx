import { ExecutorContext, GeneratorCallback, workspaceRoot } from '@nx/devkit';
import { resolve as pathResolve } from 'path';
import { ChildProcess, fork } from 'child_process';
import { platform } from 'os';

import { runCliStart } from '../start/start.impl';
import { getCliOptions } from '../../utils/get-cli-options';

import { ReactNativeRunIosOptions } from './schema';
export interface ReactNativeRunIosOutput {
  success: boolean;
}

export default async function* runIosExecutor(
  options: ReactNativeRunIosOptions,
  context: ExecutorContext
): AsyncGenerator<ReactNativeRunIosOutput> {
  if (platform() !== 'darwin') {
    throw new Error(`The run-ios build requires Mac to run`);
  }
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  const tasks = [runCliRunIOS(context.root, projectRoot, options)];

  if (options.mode !== 'Release') {
    tasks.push(
      runCliStart(context.root, projectRoot, {
        port: options.port,
        resetCache: options.resetCache,
        interactive: true,
      })
    );
  }

  await Promise.all(tasks);

  yield { success: true };
}

function runCliRunIOS(
  workspaceRoot: string,
  projectRoot: string,
  options: ReactNativeRunIosOptions
): Promise<ChildProcess> {
  return new Promise<ChildProcess>((resolve, reject) => {
    /**
     * Call the react native cli with option `--no-packager`
     * Not passing '--packager' due to cli will launch start command from the project root
     */
    const childProcess = fork(
      require.resolve('react-native/cli.js'),
      ['run-ios', ...createRunIOSOptions(options), '--no-packager'],
      {
        stdio: 'inherit',
        cwd: pathResolve(workspaceRoot, projectRoot),
        env: { ...process.env, RCT_METRO_PORT: options.port.toString() },
      }
    );

    /**
     * Ensure the child process is killed when the parent exits
     */
    const processExitListener = (signal?: number | NodeJS.Signals) => () => {
      childProcess.kill(signal);
      process.exit();
    };
    process.once('exit', (signal) => childProcess.kill(signal));
    process.once('SIGTERM', processExitListener);
    process.once('SIGINT', processExitListener);
    process.once('SIGQUIT', processExitListener);

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

const startOptions = ['port', 'resetCache'];

function createRunIOSOptions(options: ReactNativeRunIosOptions) {
  return getCliOptions<ReactNativeRunIosOptions>(options, startOptions, [
    'buildFolder',
  ]);
}
