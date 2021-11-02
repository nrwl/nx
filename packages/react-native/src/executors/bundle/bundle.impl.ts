import { createDirectory } from '@nrwl/workspace/src/utilities/fileutils';
import { toFileName } from '@nrwl/workspace/src/devkit-reexport';
import { dirname, join, relative, sep } from 'path';
import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';
import { ChildProcess, fork } from 'child_process';
import { ExecutorContext } from '@nrwl/devkit';
import { ReactNativeBundleOptions } from './schema';

export interface ReactNativeBundleOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* bundleExecutor(
  options: ReactNativeBundleOptions,
  context: ExecutorContext
): AsyncGenerator<ReactNativeBundleOutput> {
  const projectRoot = context.workspace.projects[context.projectName].root;

  options.bundleOutput = relative(context.root, projectRoot)
    .split(sep)
    .map(() => '..')
    .concat(options.bundleOutput)
    .join(sep);

  createDirectory(dirname(join(projectRoot, options.bundleOutput)));
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

function runCliBuild(workspaceRoot, projectRoot, options) {
  return new Promise((resolve, reject) => {
    const cliOptions = createBundleOptions(options);
    childProcess = fork(
      join(workspaceRoot, './node_modules/react-native/cli.js'),
      ['bundle', ...cliOptions],
      { cwd: projectRoot }
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

function createBundleOptions(options) {
  return Object.keys(options).reduce((acc, _k) => {
    const v = options[_k];
    const k = toFileName(_k);
    if (v === undefined) return acc;
    acc.push(`--${k}`, v);
    return acc;
  }, []);
}
