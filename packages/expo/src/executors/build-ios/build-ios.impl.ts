import { ExecutorContext, logger, names } from '@nrwl/devkit';
import { join } from 'path';
import { ChildProcess, fork } from 'child_process';

import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';
import {
  displayNewlyAddedDepsMessage,
  syncDeps,
} from '../sync-deps/sync-deps.impl';
import { ExpoBuildIOSOptions } from './schema';

export interface ExpoRunOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* buildIosExecutor(
  options: ExpoBuildIOSOptions,
  context: ExecutorContext
): AsyncGenerator<ExpoRunOutput> {
  logger.warn(
    '@nrwl/expo:build-status is deprecated and will be removed in Nx 16. Please switch to expo:prebuild and expo:build.'
  );
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
    await runCliBuildIOS(context.root, projectRoot, options);

    yield { success: true };
  } finally {
    if (childProcess) {
      childProcess.kill();
    }
  }
}

function runCliBuildIOS(
  workspaceRoot: string,
  projectRoot: string,
  options: ExpoBuildIOSOptions
) {
  return new Promise((resolve, reject) => {
    childProcess = fork(
      join(workspaceRoot, './node_modules/expo-cli/bin/expo.js'),
      ['build:ios', ...createRunOptions(options)],
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

const nxOptions = ['sync'];

function createRunOptions(options: ExpoBuildIOSOptions) {
  return Object.keys(options).reduce((acc, k) => {
    const v = options[k];
    if (!nxOptions.includes(k)) {
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
