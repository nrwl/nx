import { createDirectory } from '@nx/workspace/src/utilities/fileutils';
import { names, ExecutorContext } from '@nx/devkit';
import { dirname, join } from 'path';
import { ChildProcess, fork } from 'child_process';

import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';

import { ReactNativeBundleOptions } from './schema';

export interface ReactNativeBundleOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* bundleExecutor(
  options: ReactNativeBundleOptions,
  context: ExecutorContext
): AsyncGenerator<ReactNativeBundleOutput> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  options.bundleOutput = join(context.root, options.bundleOutput);

  createDirectory(dirname(options.bundleOutput));
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
  options: ReactNativeBundleOptions
) {
  return new Promise((resolve, reject) => {
    const cliOptions = createBundleOptions(options);
    childProcess = fork(
      join(workspaceRoot, './node_modules/react-native/cli.js'),
      ['bundle', ...cliOptions],
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

function createBundleOptions(options: ReactNativeBundleOptions) {
  return Object.keys(options).reduce((acc, _k) => {
    const v = options[_k];
    const k = names(_k).fileName;
    if (v === undefined) return acc;
    acc.push(`--${k}`, v);
    return acc;
  }, []);
}
