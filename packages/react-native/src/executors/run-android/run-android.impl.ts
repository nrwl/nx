import { ExecutorContext } from '@nx/devkit';
import { join, resolve as pathResolve } from 'path';
import { ChildProcess, fork } from 'child_process';

import { ReactNativeRunAndroidOptions } from './schema';
import { runCliStart } from '../start/start.impl';
import { chmodAndroidGradlewFiles } from '../../utils/chmod-android-gradle-files';
import { getCliOptions } from '../../utils/get-cli-options';

export interface ReactNativeRunAndroidOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* runAndroidExecutor(
  options: ReactNativeRunAndroidOptions,
  context: ExecutorContext
): AsyncGenerator<ReactNativeRunAndroidOutput> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  chmodAndroidGradlewFiles(join(context.root, projectRoot, 'android'));

  const tasks = [runCliRunAndroid(context.root, projectRoot, options)];

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

function runCliRunAndroid(
  workspaceRoot: string,
  projectRoot: string,
  options: ReactNativeRunAndroidOptions
): Promise<ChildProcess> {
  return new Promise<ChildProcess>((resolve, reject) => {
    /**
     * Call the react native cli with option `--no-packager`
     * Not passing '--packager' due to cli will launch start command from the project root
     */
    childProcess = fork(
      require.resolve('react-native/cli.js'),
      ['run-android', ...createRunAndroidOptions(options), '--no-packager'],
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

function createRunAndroidOptions(options: ReactNativeRunAndroidOptions) {
  return getCliOptions<ReactNativeRunAndroidOptions>(options, startOptions, [
    'appId',
    'appIdSuffix',
    'deviceId',
  ]);
}
