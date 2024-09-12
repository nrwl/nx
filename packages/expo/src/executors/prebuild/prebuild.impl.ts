import { ExecutorContext, names, workspaceRoot } from '@nx/devkit';
import { ChildProcess, fork } from 'child_process';
import { join } from 'path';

import { podInstall } from '../../utils/pod-install-task';
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

  try {
    await prebuildAsync(context.root, projectRoot, options);

    if (options.install) {
      const {
        installAsync,
      } = require('@expo/cli/build/src/install/installAsync');
      await installAsync([], {});
      if (options.platform === 'ios') {
        podInstall(join(context.root, projectRoot, 'ios'));
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
      require.resolve('@expo/cli/build/bin/cli'),
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

const nxOptions = ['install', 'interactive']; // interactive is passed in by e2e tests
// options from https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/prebuild/index.ts
function createPrebuildOptions(options: ExpoPrebuildOptions) {
  return Object.keys(options).reduce((acc, k) => {
    if (!nxOptions.includes(k)) {
      const v = options[k];
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
