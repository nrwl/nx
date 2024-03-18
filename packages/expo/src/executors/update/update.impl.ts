import { ExecutorContext, names, readJsonFile } from '@nx/devkit';
import { join, resolve as pathResolve } from 'path';
import { ChildProcess, fork } from 'child_process';

import { resolveEas } from '../../utils/resolve-eas';
import {
  displayNewlyAddedDepsMessage,
  syncDeps,
} from '../sync-deps/sync-deps.impl';
import { installAsync } from '../install/install.impl';

import { ExpoEasUpdateOptions } from './schema';

export interface ReactNativeUpdateOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* buildExecutor(
  options: ExpoEasUpdateOptions,
  context: ExecutorContext
): AsyncGenerator<ReactNativeUpdateOutput> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  const workspacePackageJsonPath = join(context.root, 'package.json');
  const projectPackageJsonPath = join(
    context.root,
    projectRoot,
    'package.json'
  );

  const workspacePackageJson = readJsonFile(workspacePackageJsonPath);
  const projectPackageJson = readJsonFile(projectPackageJsonPath);

  await installAsync(context.root, { packages: ['expo-updates'] });
  displayNewlyAddedDepsMessage(
    context.projectName,
    await syncDeps(
      context.projectName,
      projectPackageJson,
      projectPackageJsonPath,
      workspacePackageJson,
      context.projectGraph,
      ['expo-updates']
    )
  );

  try {
    await runCliUpdate(context.root, projectRoot, options);
    yield { success: true };
  } finally {
    if (childProcess) {
      childProcess.kill();
    }
  }
}

function runCliUpdate(
  workspaceRoot: string,
  projectRoot: string,
  options: ExpoEasUpdateOptions
) {
  return new Promise((resolve, reject) => {
    childProcess = fork(
      resolveEas(workspaceRoot),
      ['update', ...createUpdateOptions(options)],
      { cwd: pathResolve(workspaceRoot, projectRoot), env: process.env }
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

function createUpdateOptions(options: ExpoEasUpdateOptions) {
  return Object.keys(options).reduce((acc, k) => {
    const v = options[k];
    if (typeof v === 'boolean') {
      if (k === 'interactive') {
        if (v === false) {
          acc.push('--non-interactive');
        }
      } else if (v === true) {
        // when true, does not need to pass the value true, just need to pass the flag in kebob case
        acc.push(`--${names(k).fileName}`);
      }
    } else {
      acc.push(`--${names(k).fileName}`, v);
    }
    return acc;
  }, []);
}
