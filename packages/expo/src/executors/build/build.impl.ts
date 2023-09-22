import { ExecutorContext, names } from '@nx/devkit';
import { resolve as pathResolve, dirname } from 'path';
import { ChildProcess, fork } from 'child_process';
import { removeSync } from 'fs-extra';

import { unzipBuild } from '../download/download.impl';
import { resolveEas } from '../../utils/resolve-eas';

import { ExpoEasBuildOptions } from './schema';

export interface ReactNativeBuildOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* buildExecutor(
  options: ExpoEasBuildOptions,
  context: ExecutorContext
): AsyncGenerator<ReactNativeBuildOutput> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  try {
    // remove the output app if it already existed
    if (options.local && options.output) {
      removeSync(options.output);
      if (options.output.endsWith('.tar.gz')) {
        // remove unzipped app if it already existed
        removeSync(options.output.replace('.tar.gz', '.app'));
      }
    }

    await runCliBuild(context.root, projectRoot, options);

    // unzip the build if it's a tar.gz
    if (options.local && options.output && options.output.endsWith('.tar.gz')) {
      const outputDirectory = dirname(options.output);
      await unzipBuild(options.output, outputDirectory);
    }
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
  options: ExpoEasBuildOptions
) {
  return new Promise((resolve, reject) => {
    childProcess = fork(
      resolveEas(),
      ['build', ...createBuildOptions(options)],
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

function createBuildOptions(options: ExpoEasBuildOptions) {
  return Object.keys(options).reduce((acc, k) => {
    const v = options[k];
    if (typeof v === 'boolean') {
      if (k === 'interactive') {
        if (v === false) {
          acc.push('--non-interactive'); // when is false, the flag is --non-interactive
        }
      } else if (k === 'wait') {
        if (v === false) {
          acc.push('--no-wait'); // when is false, the flag is --no-wait
        } else {
          acc.push('--wait');
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
