import { join } from 'path';
import { ExecutorContext, logger } from '@nrwl/devkit';
import * as chalk from 'chalk';

import { ReactNativeStorybookOptions } from './schema';
import { ChildProcess, fork } from 'child_process';
import {
  displayNewlyAddedDepsMessage,
  syncDeps,
} from '../sync-deps/sync-deps.impl';

let childProcess: ChildProcess;

export default async function* reactNatievStorybookExecutor(
  options: ReactNativeStorybookOptions,
  context: ExecutorContext
): AsyncGenerator<{ success: boolean }> {
  const projectRoot = context.workspace.projects[context.projectName].root;
  logger.info(
    `${chalk.bold.cyan(
      'info'
    )} To see your Storybook stories on the device, you should start your mobile app for the <platform> of your choice (typically ios or android).`
  );

  // add storybook addons to app's package.json
  displayNewlyAddedDepsMessage(
    context.projectName,
    await syncDeps(
      context.projectName,
      projectRoot,
      context.root,
      '@storybook/addon-ondevice-actions,@storybook/addon-ondevice-backgrounds,@storybook/addon-ondevice-controls,@storybook/addon-ondevice-notes'
    )
  );

  try {
    await runCliStorybook(context.root, projectRoot, options);
    yield { success: true };
  } finally {
    if (childProcess) {
      childProcess.kill();
    }
  }
}

function runCliStorybook(
  workspaceRoot: string,
  projectRoot: string,
  options: ReactNativeStorybookOptions
) {
  return new Promise((resolve, reject) => {
    childProcess = fork(
      join(
        workspaceRoot,
        './node_modules/react-native-storybook-loader/out/rnstl-cli.js'
      ),
      createStorybookOptions(options),
      {
        cwd: workspaceRoot,
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

function createStorybookOptions(options) {
  return Object.keys(options).reduce((acc, k) => {
    const v = options[k];
    if (typeof v === 'boolean') {
      if (v === true) {
        acc.push(`--${k}`);
      }
    } else {
      acc.push(`--${k}`, options[k]);
    }
    return acc;
  }, []);
}
