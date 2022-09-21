import { ExecutorContext, names } from '@nrwl/devkit';
import { join } from 'path';
import { ChildProcess, fork } from 'child_process';

import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';

import { ExpoBuildWebOptions } from './schema';

export interface ReactNativeBuildOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* buildWebExecutor(
  options: ExpoBuildWebOptions,
  context: ExecutorContext
): AsyncGenerator<ReactNativeBuildOutput> {
  const projectRoot = context.workspace.projects[context.projectName].root;
  ensureNodeModulesSymlink(context.root, projectRoot);

  try {
    await runCliBuild(context.root, projectRoot, options);
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
  options: ExpoBuildWebOptions
) {
  return new Promise((resolve, reject) => {
    childProcess = fork(
      join(workspaceRoot, './node_modules/@expo/cli/build/bin/cli'),
      ['build:web', ...createRunOptions(options)],
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

function createRunOptions(options) {
  return Object.keys(options).reduce((acc, k) => {
    const v = options[k];
    if (typeof v === 'boolean') {
      if (v === true) {
        // when true, does not need to pass the value true, just need to pass the flag in kebob case
        acc.push(`--${names(k).fileName}`);
      }
    } else {
      acc.push(`--${names(k).fileName}`, v);
    }
    return acc;
  }, []);
}
