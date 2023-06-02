import {
  ExecutorContext,
  parseTargetString,
  readTargetOptions,
} from '@nx/devkit';
import { names } from '@nx/devkit';
import { join } from 'path';
import { ChildProcess, fork } from 'child_process';

import { DetoxBuildOptions } from '../build/schema';
import { runCliBuild } from '../build/build.impl';

import { DetoxTestOptions } from './schema';

export interface DetoxTestOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* detoxTestExecutor(
  options: DetoxTestOptions,
  context: ExecutorContext
): AsyncGenerator<DetoxTestOutput> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  try {
    if (!options.reuse && options.buildTarget) {
      const buildTarget = parseTargetString(
        options.buildTarget,
        context.projectGraph
      );
      const buildOptions = readTargetOptions<DetoxBuildOptions>(
        buildTarget,
        context
      );

      await runCliBuild(context.root, projectRoot, {
        ...buildOptions,
        detoxConfiguration: options.detoxConfiguration,
      });
    }

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

const nxOptions = ['buildTarget'];

function createDetoxTestOptions(options: DetoxTestOptions): string[] {
  return Object.keys(options).reduce((acc, k) => {
    const propertyValue = options[k];
    if (nxOptions.includes(k)) {
      return acc;
    } else if (k === 'detoxConfiguration') {
      acc.push('--configuration', propertyValue);
    } else if (k === 'deviceBootArgs') {
      acc.push(`--device-boot-args="${propertyValue}"`); // the value must be specified after an equal sign (=) and inside quotes: https://wix.github.io/Detox/docs/cli/test
    } else if (k === 'appLaunchArgs') {
      acc.push(`--app-launch-args="${propertyValue}"`); // the value must be specified after an equal sign (=) and inside quotes: https://wix.github.io/Detox/docs/cli/test
    } else if (k === 'color') {
      // detox only accepts --no-color, not --color
      if (!propertyValue) {
        acc.push('--no-color');
      }
    } else {
      const propertyName = names(k).fileName; // convert camelCase to kebab-case
      acc.push(`--${propertyName}`, propertyValue);
    }
    return acc;
  }, []);
}
