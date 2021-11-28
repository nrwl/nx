import * as chalk from 'chalk';
import { ExecutorContext, logger } from '@nrwl/devkit';
import { toFileName } from '@nrwl/workspace/src/devkit-reexport';
import { ChildProcess, fork } from 'child_process';
import { join } from 'path';

import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';
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
  const projectRoot = context.workspace.projects[context.projectName].root;
  ensureNodeModulesSymlink(context.root, projectRoot);

  try {
    const baseUrl = `http://localhost:${options.port}`;
    logger.info(chalk.cyan(`Packager is ready at ${baseUrl}`));

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
      join(workspaceRoot, './node_modules/expo/bin/cli.js'),
      [options.webpack ? 'web' : 'start', ...createStartOptions(options)],
      { cwd: join(workspaceRoot, projectRoot) }
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

const nxOptions = ['webpack'];
function createStartOptions(options: ExpoStartOptions) {
  return Object.keys(options).reduce((acc, k) => {
    const v = options[k];
    if (k === 'dev' && v === false) {
      acc.push(`--no-dev`);
    } else if (k === 'minify' && v === false) {
      acc.push(`--no-minify`);
    } else if (k === 'https' && v === false) {
      acc.push(`--no-https`);
    } else if (!nxOptions.includes(k)) {
      if (v === true) {
        // when true, does not need to pass the value true, just need to pass the flag in kebob case
        acc.push(`--${toFileName(k)}`);
      } else {
        acc.push(`--${toFileName(k)}`, v);
      }
    }
    return acc;
  }, []);
}
