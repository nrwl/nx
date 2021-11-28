import { ExecutorContext } from '@nrwl/devkit';
import { join } from 'path';
import { ChildProcess, fork } from 'child_process';
import { platform } from 'os';
import { toFileName } from '@nrwl/workspace/src/devkit-reexport';

import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';
import {
  displayNewlyAddedDepsMessage,
  syncDeps,
} from '../sync-deps/sync-deps.impl';
import { ExpoRunOptions } from './schema';

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
  const projectRoot = context.workspace.projects[context.projectName].root;
  ensureNodeModulesSymlink(context.root, projectRoot);
  if (options.sync) {
    displayNewlyAddedDepsMessage(
      context.projectName,
      await syncDeps(context.projectName, projectRoot)
    );
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
      join(workspaceRoot, './node_modules/expo/bin/cli.js'),
      ['run:' + options.platform, ...createRunOptions(options)],
      {
        cwd: projectRoot,
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

const nxOptions = ['sync', 'platform'];
const iOSOptions = ['xcodeConfiguration', 'schema'];
const androidOptions = ['variant'];

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
      } else if (k === 'bundler') {
        if (v === false) {
          acc.push('--no-bundler');
        }
      } else if (v === true) {
        // when true, does not need to pass the value true, just need to pass the flag in kebob case
        acc.push(`--${toFileName(k)}`);
      } else {
        acc.push(`--${toFileName(k)}`, v);
      }
    }
    return acc;
  }, []);
}
