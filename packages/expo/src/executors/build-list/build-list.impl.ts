import { ExecutorContext, logger, names } from '@nx/devkit';
import { signalToCode } from '@nx/devkit/internal';
import { resolve as pathResolve } from 'path';
import { ChildProcess, fork } from 'child_process';

import { resolveEas } from '../../utils/resolve-eas';

import { ExpoEasBuildListOptions } from './schema';

export interface ReactNativeBuildListOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* buildListExecutor(
  options: ExpoEasBuildListOptions,
  context: ExecutorContext
): AsyncGenerator<ReactNativeBuildListOutput> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  try {
    if (options.json) {
      // when json is true, interactive has to be false
      options.interactive = false;
    }
    await runCliBuildList(context.root, projectRoot, options);

    yield { success: true };
  } finally {
    if (childProcess) {
      childProcess.kill();
    }
  }
}

export function runCliBuildList(
  workspaceRoot: string,
  projectRoot: string,
  options: ExpoEasBuildListOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    childProcess = fork(
      resolveEas(workspaceRoot),
      ['build:list', ...createBuildListOptions(options)],
      {
        cwd: pathResolve(workspaceRoot, projectRoot),
        env: process.env,
        stdio: ['inherit', 'pipe', 'inherit', 'ipc'], // only stream stdout on child process
      }
    );

    // Ensure the child process is killed when the parent exits
    process.on('exit', () => childProcess.kill());
    process.on('SIGTERM', () => childProcess.kill());

    let output = '';
    childProcess.stdout.on('data', (message) => {
      output += message.toString();
      logger.info(message.toString());
      // when interactive is false, resolve the promise when the child process exits
      if (options.interactive === false) {
        resolve(message.toString());
      }
    });
    childProcess.on('error', (err) => {
      reject(err);
    });
    childProcess.on('exit', (code, signal) => {
      if (code === null) code = signalToCode(signal);
      if (code === 0) {
        resolve(output);
      } else {
        reject(code);
      }
    });
  });
}

const nxOptions = ['output'];
function createBuildListOptions(options: ExpoEasBuildListOptions): string[] {
  return Object.keys(options).reduce((acc, optionKey) => {
    const optionValue = options[optionKey];
    if (!nxOptions.includes(optionKey)) {
      if (optionKey === 'interactive') {
        if (optionValue === false) {
          acc.push(`--non-interactive`);
        }
      } else if (typeof optionValue === 'boolean') {
        if (optionValue === true) {
          // when true, does not need to pass the value true, just need to pass the flag in camel case
          acc.push(`--${names(optionKey).propertyName}`);
        }
      } else {
        acc.push(`--${names(optionKey).propertyName}`, optionValue);
      }
    }
    return acc;
  }, []);
}
