import { ExecutorContext } from '@nrwl/devkit';
import { ChildProcess, fork } from 'child_process';
import { join } from 'path';

import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';
import { podInstall } from '../../utils/pod-install-task';
import { ExpoEjectOptions } from './schema';

export interface ExpoEjectOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* ejectExecutor(
  options: ExpoEjectOptions,
  context: ExecutorContext
): AsyncGenerator<ExpoEjectOutput> {
  const projectRoot = context.workspace.projects[context.projectName].root;
  ensureNodeModulesSymlink(context.root, projectRoot);

  try {
    await ejectAsync(context.root, projectRoot, options);

    if (options.install) {
      await podInstall(join(context.root, projectRoot, 'ios'));
    }

    yield {
      success: true,
    };
  } finally {
    if (childProcess) {
      childProcess.kill();
    }
  }
}

function ejectAsync(
  workspaceRoot: string,
  projectRoot: string,
  options: ExpoEjectOptions
): Promise<number> {
  return new Promise((resolve, reject) => {
    childProcess = fork(
      join(workspaceRoot, './node_modules/@expo/cli/build/bin/cli'),
      ['eject', ...createEjectOptions(options), '--no-install'],
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

const nxOptions = ['install'];
function createEjectOptions(options: ExpoEjectOptions) {
  return Object.keys(options).reduce((acc, k) => {
    const v = options[k];
    if (!nxOptions.includes(k)) {
      acc.push(`--${k}`, v);
    }
    return acc;
  }, []);
}
