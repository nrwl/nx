import { ExecutorContext } from '@nrwl/devkit';
import { join } from 'path';
import { ChildProcess, fork } from 'child_process';
import { toFileName } from '@nrwl/workspace/src/devkit-reexport';

import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';
import {
  displayNewlyAddedDepsMessage,
  syncDeps,
} from '../sync-deps/sync-deps.impl';
import { ExpoBuildIOSOptions } from './schema';

export interface ExpoRunOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* buildIosExecutor(
  options: ExpoBuildIOSOptions,
  context: ExecutorContext
): AsyncGenerator<ExpoRunOutput> {
  const projectRoot = context.workspace.projects[context.projectName].root;
  ensureNodeModulesSymlink(context.root, projectRoot);
  if (options.sync) {
    displayNewlyAddedDepsMessage(
      context.projectName,
      await syncDeps(context.projectName, projectRoot)
    );
  }

  try {
    await runCliBuildIOS(context.root, projectRoot, options);

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
  options: ExpoBuildIOSOptions
) {
  return new Promise((resolve, reject) => {
    childProcess = fork(
      join(workspaceRoot, './node_modules/expo/bin/cli.js'),
      ['build:ios', ...createRunOptions(options)],
      { cwd: join(workspaceRoot, projectRoot) }
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

const nxOptions = ['sync'];

function createRunOptions(options) {
  return Object.keys(options).reduce((acc, k) => {
    const v = options[k];
    if (!nxOptions.includes(k)) {
      if (v === true) {
        // when true, does not need to pass the value true, just need to pass the flag in kebob case
        acc.push(`--${toFileName(k)}`);
      } else {
        acc.push(`--${toFileName(k)}`, v);
      }
    }
    return acc;
  }, []);
}
