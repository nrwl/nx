import { ExecutorContext, names } from '@nx/devkit';
import { join } from 'path';
import { ChildProcess, fork } from 'child_process';

import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';

import { ExpoEasUpdateOptions } from './schema';
import {
  displayNewlyAddedDepsMessage,
  syncDeps,
} from '../sync-deps/sync-deps.impl';
import { installAsync } from '../install/install.impl';

export interface ReactNativeUpdateOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* buildExecutor(
  options: ExpoEasUpdateOptions,
  context: ExecutorContext
): AsyncGenerator<ReactNativeUpdateOutput> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  await installAsync(context.root, { packages: ['expo-updates'] });
  displayNewlyAddedDepsMessage(
    context.projectName,
    await syncDeps(
      context.projectName,
      projectRoot,
      context.root,
      context.projectGraph,
      ['expo-updates']
    )
  );
  ensureNodeModulesSymlink(context.root, projectRoot);

  try {
    await runCliUpdate(context.root, projectRoot, options);
    yield { success: true };
  } finally {
    if (childProcess) {
      childProcess.kill();
    }
  }
}

function runCliUpdate(
  workspaceRoot: string,
  projectRoot: string,
  options: ExpoEasUpdateOptions
) {
  return new Promise((resolve, reject) => {
    childProcess = fork(
      join(workspaceRoot, './node_modules/eas-cli/bin/run'),
      ['update', ...createUpdateOptions(options)],
      { cwd: join(workspaceRoot, projectRoot), env: process.env }
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

function createUpdateOptions(options: ExpoEasUpdateOptions) {
  return Object.keys(options).reduce((acc, k) => {
    const v = options[k];
    if (typeof v === 'boolean') {
      if (k === 'interactive') {
        if (v === false) {
          acc.push('--non-interactive');
        }
      } else if (v === true) {
        // when true, does not need to pass the value true, just need to pass the flag in kebob case
        acc.push(`--${names(k).fileName}`);
      }
    } else {
      acc.push(`--${names(k).fileName}`, v);
    }
    return acc;
  }, []);
}
