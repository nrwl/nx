import { ExecutorContext, names } from '@nx/devkit';
import { join } from 'path';
import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';
import { ChildProcess, fork } from 'child_process';
import { ReactNativeBuildAndroidOptions } from './schema';
import { chmodAndroidGradlewFiles } from '../../utils/chmod-android-gradle-files';
import { runCliStart } from '../start/start.impl';
import {
  displayNewlyAddedDepsMessage,
  syncDeps,
} from '../sync-deps/sync-deps.impl';
import { getCliOptions } from '../../utils/get-cli-options';

export interface ReactNativeBuildOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* buildAndroidExecutor(
  options: ReactNativeBuildAndroidOptions,
  context: ExecutorContext
): AsyncGenerator<ReactNativeBuildOutput> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  ensureNodeModulesSymlink(context.root, projectRoot);
  if (options.sync) {
    displayNewlyAddedDepsMessage(
      context.projectName,
      await syncDeps(
        context.projectName,
        projectRoot,
        context.root,
        context.projectGraph
      )
    );
  }

  chmodAndroidGradlewFiles(join(projectRoot, 'android'));

  try {
    const tasks = [runCliBuild(context.root, projectRoot, options)];
    if (options.packager && options.mode !== 'release') {
      tasks.push(
        runCliStart(context.root, projectRoot, {
          port: options.port,
          resetCache: options.resetCache,
          interactive: options.interactive,
        })
      );
    }

    await Promise.all(tasks);
    yield { success: true };
  } finally {
    if (childProcess) {
      childProcess.kill();
    }
  }
}

function runCliBuild(
  workspaceRoot: string,
  projectRoot: string,
  options: ReactNativeBuildAndroidOptions
) {
  return new Promise((resolve, reject) => {
    /**
     * Call the react native cli with option `--no-packager`
     * Not passing '--packager' due to cli will launch start command from the project root
     */
    childProcess = fork(
      join(workspaceRoot, './node_modules/react-native/cli.js'),
      ['build-android', ...createBuildAndroidOptions(options), '--no-packager'],
      {
        cwd: join(workspaceRoot, projectRoot),
        env: { ...process.env, RCT_METRO_PORT: options.port.toString() },
      }
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
