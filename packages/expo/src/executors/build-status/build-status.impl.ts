import { ExecutorContext, logger, names } from '@nrwl/devkit';
import { join } from 'path';
import { ChildProcess, fork } from 'child_process';

import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';

import { ExpoBuildStatusOptions } from './schema';

export interface ReactNativeBuildOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* buildStatusExecutor(
  options: ExpoBuildStatusOptions,
  context: ExecutorContext
): AsyncGenerator<ReactNativeBuildOutput> {
  logger.warn(
    '@nrwl/expo:build-status is deprecated and will be removed in Nx 16. Please switch to expo:build-list.'
  );

  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
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

function runCliBuild(
  workspaceRoot: string,
  projectRoot: string,
  options: ExpoBuildStatusOptions
) {
  return new Promise((resolve, reject) => {
    childProcess = fork(
      join(workspaceRoot, './node_modules/expo-cli/bin/expo.js'),
      ['build:status', ...createRunOptions(options)],
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

function createRunOptions(options) {
  return Object.keys(options).reduce((acc, k) => {
    const v = options[k];
    if (typeof v === 'boolean') {
      if (v === true) {
        // when true, does not need to pass the value true, just need to pass the flag in kebob case
        acc.push(`--${names(k).fileName}`);
      }
    } else {
      acc.push(`--${names(k).fileName}`, v);
    }
    return acc;
  }, []);
}
