import { ExecutorContext, names } from '@nx/devkit';
import { ChildProcess, fork } from 'child_process';
import { join } from 'path';

import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';
import { podInstall } from '../../utils/pod-install-task';
import { installAsync } from '../install/install.impl';
import { ExpoPrebuildOptions } from './schema';

export interface ExpoPrebuildOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* prebuildExecutor(
  options: ExpoPrebuildOptions,
  context: ExecutorContext
): AsyncGenerator<ExpoPrebuildOutput> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  ensureNodeModulesSymlink(context.root, projectRoot);

  try {
    await prebuildAsync(context.root, projectRoot, options);

    if (options.install) {
      await installAsync(context.root, {});
      if (options.platform === 'ios') {
        await podInstall(join(context.root, projectRoot, 'ios'));
      }
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

export function prebuildAsync(
  workspaceRoot: string,
  projectRoot: string,
  options: ExpoPrebuildOptions
): Promise<number> {
  return new Promise((resolve, reject) => {
    childProcess = fork(
      join(workspaceRoot, './node_modules/@expo/cli/build/bin/cli'),
      ['prebuild', ...createPrebuildOptions(options), '--no-install'],
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

const nxOptions = ['install', 'interactive'];
// options from https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/prebuild/index.ts
function createPrebuildOptions(options: ExpoPrebuildOptions) {
  return Object.keys(options).reduce((acc, k) => {
    if (!nxOptions.includes(k)) {
      const v = options[k];
      acc.push(`--${names(k).fileName}=${v}`);
    }
    return acc;
  }, []);
}
