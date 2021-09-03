import { ExecutorContext } from '@nrwl/devkit';
import { toFileName } from '@nrwl/workspace/src/devkit-reexport';
import { join } from 'path';
import { ChildProcess, fork } from 'child_process';

import { DetoxTestOptions } from './schema';

export interface DetoxTestOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* detoxTestExecutor(
  options: DetoxTestOptions,
  context: ExecutorContext
): AsyncGenerator<DetoxTestOutput> {
  const projectRoot = context.workspace.projects[context.projectName].root;

  try {
    await runCliTest(context.root, projectRoot, options);

    yield { success: true };
  } finally {
    if (childProcess) {
      childProcess.kill();
    }
  }
}

function runCliTest(
  workspaceRoot: string,
  projectRoot: string,
  options: DetoxTestOptions
) {
  return new Promise((resolve, reject) => {
    childProcess = fork(
      join(workspaceRoot, './node_modules/detox/local-cli/cli.js'),
      ['test', ...createDetoxTestOptions(options)],
      {
        cwd: projectRoot,
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

function createDetoxTestOptions(options: DetoxTestOptions): string[] {
  return Object.keys(options).reduce((acc, k) => {
    const propertyName = toFileName(k); // convert camelCase to kebab-case
    const propertyValue = options[k];
    if (k === 'detoxConfiguration') {
      acc.push('--configuration', propertyValue);
    } else if (k === 'deviceLaunchArgs') {
      acc.push(`--device-launch-args="${propertyValue}"`); // the value must be specified after an equal sign (=) and inside quotes.
    } else if (k === 'appLaunchArgs') {
      acc.push(`--app-launch-argss="${propertyValue}"`); // the value must be specified after an equal sign (=) and inside quotes.
    } else {
      acc.push(`--${propertyName}`, propertyValue);
    }
    return acc;
  }, []);
}
