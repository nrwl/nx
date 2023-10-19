import { ExecutorContext } from '@nx/devkit';
import { resolve as pathResolve } from 'path';
import { ChildProcess, fork } from 'child_process';
import { platform } from 'os';

import { ReactNativeBuildIosOptions } from './schema';
import { getCliOptions } from '../../utils/get-cli-options';

export interface ReactNativeBuildIosOutput {
  success: boolean;
}

export default async function* buildIosExecutor(
  options: ReactNativeBuildIosOptions,
  context: ExecutorContext
): AsyncGenerator<ReactNativeBuildIosOutput> {
  if (platform() !== 'darwin') {
    throw new Error(`The run-ios build requires Mac to run`);
  }
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  await runCliBuildIOS(context.root, projectRoot, options);
  return { success: true };
}

function runCliBuildIOS(
  workspaceRoot: string,
  projectRoot: string,
  options: ReactNativeBuildIosOptions
): Promise<ChildProcess> {
  return new Promise<ChildProcess>((resolve, reject) => {
    const childProcess = fork(
      require.resolve('react-native/cli.js'),
      [
        'build-ios',
        ...createBuildIOSOptions(options),
        ...(process.env.NX_VERBOSE_LOGGING === 'true' ? ['--verbose'] : []),
      ],
      {
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

function createBuildIOSOptions(options: ReactNativeBuildIosOptions) {
  return getCliOptions<ReactNativeBuildIosOptions>(options, startOptions, [
    'buildFolder',
  ]);
}
