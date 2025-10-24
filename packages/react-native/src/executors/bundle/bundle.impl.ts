import { names, ExecutorContext } from '@nx/devkit';
import { signalToCode } from '@nx/devkit/internal';
import { dirname, join, resolve as pathResolve } from 'path';
import { ChildProcess, fork } from 'child_process';

import { ReactNativeBundleOptions } from './schema';
import { mkdirSync } from 'fs';

export interface ReactNativeBundleOutput {
  success: boolean;
}

export default async function* bundleExecutor(
  options: ReactNativeBundleOptions,
  context: ExecutorContext
): AsyncGenerator<ReactNativeBundleOutput> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  options.bundleOutput = join(context.root, options.bundleOutput);

  mkdirSync(dirname(options.bundleOutput));

  await runCliBuild(context.root, projectRoot, options);
  yield { success: true };
}

function runCliBuild(
  workspaceRoot: string,
  projectRoot: string,
  options: ReactNativeBundleOptions
): Promise<ChildProcess> {
  return new Promise<ChildProcess>((resolve, reject) => {
    const cliOptions = createBundleOptions(options);
    const childProcess = fork(
      require.resolve('react-native/cli.js'),
      ['bundle', ...cliOptions],
      {
        stdio: 'inherit',
        cwd: pathResolve(workspaceRoot, projectRoot),
        env: process.env,
      }
    );

    /**
     * Ensure the child process is killed when the parent exits
     */
    const processExitListener = (signal?: number | NodeJS.Signals) => () => {
      childProcess.kill(signal);
      process.exit();
    };
    process.once('exit', (signal) => childProcess.kill(signal));
    process.once('SIGTERM', processExitListener);
    process.once('SIGINT', processExitListener);
    process.once('SIGQUIT', processExitListener);

    childProcess.on('error', (err) => {
      reject(err);
    });
    childProcess.on('exit', (code, signal) => {
      if (code === null) code = signalToCode(signal);
      if (code === 0) {
        resolve(childProcess);
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
