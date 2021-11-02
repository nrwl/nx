import { ExecutorContext } from '@nrwl/devkit';
import { join } from 'path';
import { ChildProcess, fork } from 'child_process';

import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';
import {
  displayNewlyAddedDepsMessage,
  syncDeps,
} from '../sync-deps/sync-deps.impl';
import { chmodSync } from 'fs';
import { ReactNativeRunAndroidOptions } from './schema';
import { runCliStart } from '../start/start.impl';

export interface ReactNativeRunAndroidOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* runAndroidExecutor(
  options: ReactNativeRunAndroidOptions,
  context: ExecutorContext
): AsyncGenerator<ReactNativeRunAndroidOutput> {
  const projectRoot = context.workspace.projects[context.projectName].root;
  ensureNodeModulesSymlink(context.root, projectRoot);
  chmodSync(join(projectRoot, 'android', 'gradlew'), 0o775);
  chmodSync(join(projectRoot, 'android', 'gradlew.bat'), 0o775);

  if (options.sync) {
    displayNewlyAddedDepsMessage(
      context.projectName,
      await syncDeps(context.projectName, projectRoot)
    );
  }

  try {
    const tasks = [runCliRunAndroid(context.root, projectRoot, options)];
    if (options.packager) {
      tasks.push(
        runCliStart(context.root, projectRoot, { port: options.port })
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

function runCliRunAndroid(
  workspaceRoot: string,
  projectRoot: string,
  options: ReactNativeRunAndroidOptions
) {
  return new Promise((resolve, reject) => {
    /**
     * Call the react native cli with option `--no-packager`
     * Not passing '--packager' due to cli will launch start command from the project root
     */
    childProcess = fork(
      join(workspaceRoot, './node_modules/react-native/cli.js'),
      ['run-android', ...createRunAndroidOptions(options), '--no-packager'],
      {
        cwd: projectRoot,
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

function createRunAndroidOptions(options) {
  return Object.keys(options).reduce((acc, k) => {
    const v = options[k];
    if (k === 'mainActivity') {
      acc.push(`--main-activity`, v);
    } else if (k === 'jetifier') {
      if (!v) {
        acc.push(`--no-jetifier`);
      }
    } else if (v && !nxOptions.includes(k)) {
      acc.push(`--${k}`, v);
    }
    return acc;
  }, []);
}
