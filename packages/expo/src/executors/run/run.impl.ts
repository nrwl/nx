import { ExecutorContext, names } from '@nx/devkit';
import { join, resolve as pathResolve } from 'path';
import { ChildProcess, fork } from 'child_process';
import { platform } from 'os';
import { existsSync } from 'fs-extra';

import { ExpoRunOptions } from './schema';
import { prebuildAsync } from '../prebuild/prebuild.impl';
import { podInstall } from '../../utils/pod-install-task';
import { installAsync } from '../install/install.impl';

export interface ExpoRunOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* runExecutor(
  options: ExpoRunOptions,
  context: ExecutorContext
): AsyncGenerator<ExpoRunOutput> {
  if (platform() !== 'darwin' && options.platform === 'ios') {
    throw new Error(`The run-ios build requires Mac to run`);
  }
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  if (!existsSync(join(context.root, projectRoot, options.platform))) {
    await prebuildAsync(context.root, projectRoot, {
      install: options.install,
      platform: options.platform,
      clean: options.clean,
    });
  }

  if (options.install) {
    await installAsync(context.root, {});
    if (options.platform === 'ios') {
      podInstall(join(context.root, projectRoot, 'ios'));
    }
  }

  try {
    await runCliRun(context.root, projectRoot, options);

    yield { success: true };
  } finally {
    if (childProcess) {
      childProcess.kill();
    }
  }
}

function runCliRun(
  workspaceRoot: string,
  projectRoot: string,
  options: ExpoRunOptions
) {
  return new Promise((resolve, reject) => {
    childProcess = fork(
      require.resolve('@expo/cli/build/bin/cli'),
      ['run:' + options.platform, ...createRunOptions(options), '--no-install'], // pass in no-install to prevent node_modules install
      {
        cwd: pathResolve(workspaceRoot, projectRoot),
        env: process.env,
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

const nxOptions = ['platform', 'clean'];
const iOSOptions = ['xcodeConfiguration', 'schema'];
const androidOptions = ['variant'];
/*
 * run options:
 * ios: https://github.com/expo/expo/blob/main/packages/@expo/cli/src/run/ios/index.ts
 * android: https://github.com/expo/expo/blob/main/packages/@expo/cli/src/run/android/index.ts
 */
function createRunOptions(options: ExpoRunOptions) {
  return Object.keys(options).reduce((acc, k) => {
    if (
      nxOptions.includes(k) ||
      (options.platform === 'ios' && androidOptions.includes(k)) ||
      (options.platform === 'android' && iOSOptions.includes(k))
    ) {
      return acc;
    }
    const v = options[k];
    {
      if (k === 'xcodeConfiguration') {
        acc.push('--configuration', v);
      } else if (typeof v === 'boolean') {
        // no need to pass in the flag when it is true, pass the --no-<flag> when it is false. e.g. --no-build-cache, --no-bundler
        if (v === false) {
          acc.push(`--no-${names(k).fileName}`);
        }
      } else {
        acc.push(`--${names(k).fileName}`, v);
      }
    }
    return acc;
  }, []);
}
