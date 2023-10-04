import { ExecutorContext } from '@nx/devkit';
import { join, resolve as pathResolve } from 'path';
import { ChildProcess, fork } from 'child_process';
import { ReactNativeBuildAndroidOptions } from './schema';
import { chmodAndroidGradlewFiles } from '../../utils/chmod-android-gradle-files';
import { getCliOptions } from '../../utils/get-cli-options';

export interface ReactNativeBuildOutput {
  success: boolean;
}

export default async function* buildAndroidExecutor(
  options: ReactNativeBuildAndroidOptions,
  context: ExecutorContext
): AsyncGenerator<ReactNativeBuildOutput> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  chmodAndroidGradlewFiles(join(projectRoot, 'android'));

  await runCliBuild(context.root, projectRoot, options);
  yield { success: true };
}

function runCliBuild(
  workspaceRoot: string,
  projectRoot: string,
  options: ReactNativeBuildAndroidOptions
) {
  return new Promise<ChildProcess>((res, reject) => {
    /**
     * Call the react native cli with option `--no-packager`
     * Not passing '--packager' due to cli will launch start command from the project root
     */
    const childProcess = fork(
      require.resolve('react-native/cli.js'),
      ['build-android', ...createBuildAndroidOptions(options), '--no-packager'],
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
        res(childProcess);
      } else {
        reject(code);
      }
    });
  });
}

const nxOptions = ['sync', 'packager'];
const startOptions = ['port', 'resetCache'];
const deprecatedOptions = ['apk', 'debug', 'gradleTask'];

function createBuildAndroidOptions(options: ReactNativeBuildAndroidOptions) {
  return getCliOptions<ReactNativeBuildAndroidOptions>(options, [
    ...nxOptions,
    ...startOptions,
    ...deprecatedOptions,
  ]);
}
