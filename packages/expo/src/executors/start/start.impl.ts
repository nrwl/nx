import * as pc from 'picocolors';
import { ExecutorContext, logger, names } from '@nx/devkit';
import { ChildProcess, fork } from 'child_process';
import { resolve as pathResolve } from 'path';

import { ExpoStartOptions } from './schema';

export interface ExpoStartOutput {
  baseUrl?: string;
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* startExecutor(
  options: ExpoStartOptions,
  context: ExecutorContext
): AsyncGenerator<ExpoStartOutput> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  try {
    const baseUrl = `http://localhost:${options.port}`;
    logger.info(pc.cyan(`Packager is ready at ${baseUrl}`));

    await startAsync(context.root, projectRoot, options);

    yield {
      baseUrl,
      success: true,
    };
  } finally {
    if (childProcess) {
      childProcess.kill();
    }
  }
}

function startAsync(
  workspaceRoot: string,
  projectRoot: string,
  options: ExpoStartOptions
): Promise<number> {
  return new Promise((resolve, reject) => {
    childProcess = fork(
      require.resolve('@expo/cli/build/bin/cli'),
      ['start', ...createStartOptions(options)],
      {
        cwd: pathResolve(workspaceRoot, projectRoot),
        env: {
          RCT_METRO_PORT: options.port.toString(),
          ...process.env,
        },
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

// options from https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/start/index.ts
const nxOptions = ['sync'];
function createStartOptions(options: ExpoStartOptions) {
  return Object.keys(options).reduce((acc, k) => {
    if (nxOptions.includes(k)) {
      return acc;
    }
    const v = options[k];
    if (k === 'dev') {
      if (v === false) {
        acc.push(`--no-dev`); // only no-dev flag is supported
      }
    } else {
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
