import { ExecutorContext, names } from '@nx/devkit';
import { ChildProcess, fork } from 'child_process';
import { join } from 'path';

import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';
import { ExpoInstallOptions } from './schema';

export interface ExpoInstallOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* installExecutor(
  options: ExpoInstallOptions,
  context: ExecutorContext
): AsyncGenerator<ExpoInstallOutput> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  try {
    await installAsync(context.root, options);
    ensureNodeModulesSymlink(context.root, projectRoot);

    yield {
      success: true,
    };
  } finally {
    if (childProcess) {
      childProcess.kill();
    }
  }
}

export function installAsync(
  workspaceRoot: string,
  options: ExpoInstallOptions
): Promise<number> {
  return new Promise((resolve, reject) => {
    childProcess = fork(
      join(workspaceRoot, './node_modules/@expo/cli/build/bin/cli'),
      ['install', ...createInstallOptions(options)],
      { cwd: workspaceRoot, env: process.env }
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

// options from https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/install/index.ts
function createInstallOptions(options: ExpoInstallOptions) {
  return Object.keys(options).reduce((acc, k) => {
    const v = options[k];
    if (k === 'packages') {
      const packages = typeof v === 'string' ? v.split(',') : v;
      acc.push(...packages);
    } else {
      if (typeof v === 'boolean') {
        if (v === true) {
          // when true, does not need to pass the value true, just need to pass the flag in kebob case
          acc.push(`--${names(k).fileName}`);
        }
      } else {
        acc.push(`--${names(k).fileName}`, v);
      }
    }
    return acc;
  }, []);
}
