import { ExecutorContext } from '@nx/devkit';
import { signalToCode } from '@nx/devkit/internal';
import { resolve as pathResolve } from 'path';
import { ChildProcess, fork } from 'child_process';

import { DetoxBuildOptions } from './schema';

export interface DetoxBuildOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* detoxBuildExecutor(
  options: DetoxBuildOptions,
  context: ExecutorContext
): AsyncGenerator<DetoxBuildOutput> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  try {
    await runCliBuild(context.root, projectRoot, options);

    yield { success: true };
  } finally {
    if (childProcess) {
      childProcess.kill();
    }
  }
}

export function runCliBuild(
  workspaceRoot: string,
  projectRoot: string,
  options: DetoxBuildOptions
) {
  return new Promise((resolve, reject) => {
    childProcess = fork(
      require.resolve('detox/local-cli/cli.js'),
      ['build', ...createDetoxBuildOptions(options)],
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
    childProcess.on('exit', (code, signal) => {
      if (code === null) code = signalToCode(signal);
      if (code === 0) {
        resolve(code);
      } else {
        reject(code);
      }
    });
  });
}

function createDetoxBuildOptions(options) {
  return Object.keys(options).reduce((acc, k) => {
    const v = options[k];
    if (k === 'detoxConfiguration') {
      acc.push('--configuration', v);
    } else if (k === 'configPath') {
      acc.push('--config-path', v);
    } else acc.push(`--${k}`, options[k]);
    return acc;
  }, []);
}
