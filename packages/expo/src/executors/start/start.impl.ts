import * as chalk from 'chalk';
import { ExecutorContext, logger, names } from '@nx/devkit';
import { ChildProcess, fork } from 'child_process';
import { join } from 'path';

import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';
import { ExpoStartOptions } from './schema';
import {
  displayNewlyAddedDepsMessage,
  syncDeps,
} from '../sync-deps/sync-deps.impl';

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
  ensureNodeModulesSymlink(context.root, projectRoot);
  if (options.sync) {
    displayNewlyAddedDepsMessage(
      context.projectName,
      await syncDeps(
        context.projectName,
        projectRoot,
        context.root,
        context.projectGraph
      )
    );
  }

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
      join(workspaceRoot, './node_modules/@expo/cli/build/bin/cli'),
      ['start', ...createStartOptions(options)],
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
