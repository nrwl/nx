import { ExecutorContext, logger, names } from '@nrwl/devkit';
import { join } from 'path';
import { ChildProcess, fork } from 'child_process';

import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';
import { ExpoRollbackOptions } from './schema';

export interface ExpoRollbackOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* rollbackExecutor(
  options: ExpoRollbackOptions,
  context: ExecutorContext
): AsyncGenerator<ExpoRollbackOutput> {
  logger.warn(
    '@nrwl/expo:rollback is deprecated and will be removed in Nx 16.'
  );

  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  ensureNodeModulesSymlink(context.root, projectRoot);

  try {
    await runCliRollback(context.root, projectRoot, options);

    yield { success: true };
  } finally {
    if (childProcess) {
      childProcess.kill();
    }
  }
}

function runCliRollback(
  workspaceRoot: string,
  projectRoot: string,
  options: ExpoRollbackOptions
) {
  return new Promise((resolve, reject) => {
    childProcess = fork(
      join(workspaceRoot, './node_modules/expo-cli/bin/expo.js'),
      ['publish:rollback', ...createRollbackOptions(options)],
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

function createRollbackOptions(options: ExpoRollbackOptions) {
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
