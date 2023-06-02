import { ExecutorContext } from '@nx/devkit';
import { join } from 'path';
import { ChildProcess, fork } from 'child_process';
import { platform } from 'os';

import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';
import {
  displayNewlyAddedDepsMessage,
  syncDeps,
} from '../sync-deps/sync-deps.impl';
import { podInstall } from '../../utils/pod-install-task';
import { ReactNativeBuildIosOptions } from './schema';
import { runCliStart } from '../start/start.impl';
import { getCliOptions } from '../../utils/get-cli-options';

export interface ReactNativeBuildIosOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* runIosExecutor(
  options: ReactNativeBuildIosOptions,
  context: ExecutorContext
): AsyncGenerator<ReactNativeBuildIosOutput> {
  if (platform() !== 'darwin') {
    throw new Error(`The run-ios build requires Mac to run`);
  }
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

  if (options.install) {
    await podInstall(
      join(context.root, projectRoot, 'ios'),
      options.buildFolder
    );
  }

  try {
    const tasks = [runCliBuildIOS(context.root, projectRoot, options)];
    if (options.packager && options.mode !== 'Release') {
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

function runCliBuildIOS(
  workspaceRoot: string,
  projectRoot: string,
  options: ReactNativeBuildIosOptions
) {
  return new Promise((resolve, reject) => {
    /**
     * Call the react native cli with option `--no-packager`
     * Not passing '--packager' due to cli will launch start command from the project root
     */
    childProcess = fork(
      join(workspaceRoot, './node_modules/react-native/cli.js'),
      ['build-ios', ...createBuildIOSOptions(options)],
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

const nxOptions = ['sync', 'install', 'packager'];
const startOptions = ['port', 'resetCache'];

function createBuildIOSOptions(options: ReactNativeBuildIosOptions) {
  return getCliOptions<ReactNativeBuildIosOptions>(
    options,
    [...nxOptions, ...startOptions],
    ['buildFolder']
  );
}
