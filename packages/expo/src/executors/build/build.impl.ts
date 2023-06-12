import { ExecutorContext, names } from '@nx/devkit';
import { join, normalize, sep } from 'path';
import { ChildProcess, fork } from 'child_process';

import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';
import { unzipBuild } from '../download/download.impl';

import { ExpoEasBuildOptions } from './schema';
import { removeSync } from 'fs-extra';

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
  ensureNodeModulesSymlink(context.root, projectRoot);

  try {
    // remove the output app if it already existed
    if (options.local && options.output) {
      removeSync(options.output);
    }

    await runCliBuild(context.root, projectRoot, options);

    // unzip the build if it's a tar.gz
    if (options.local && options.output && options.output.endsWith('.tar.gz')) {
      const directoryPath = normalize(options.output).split(sep);
      directoryPath.pop();
      const outputDirectory = directoryPath.join(sep);
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
      join(workspaceRoot, './node_modules/eas-cli/bin/run'),
      ['build', ...createBuildOptions(options)],
      {
        cwd: join(workspaceRoot, projectRoot),
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
