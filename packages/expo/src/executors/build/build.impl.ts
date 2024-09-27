import {
  detectPackageManager,
  ExecutorContext,
  names,
  PackageManager,
  readJsonFile,
  writeJsonFile,
} from '@nx/devkit';
import { getLockFileName } from '@nx/js';
import { ChildProcess, fork } from 'child_process';
import { copyFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { resolve as pathResolve } from 'path';
import type { PackageJson } from 'nx/src/utils/package-json';

import { resolveEas } from '../../utils/resolve-eas';

import { ExpoEasBuildOptions } from './schema';

export interface ReactNativeBuildOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* buildExecutor(
  options: ExpoEasBuildOptions,
  context: ExecutorContext
): AsyncGenerator<ReactNativeBuildOutput> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  let resetLocalFunction;

  try {
    resetLocalFunction = copyPackageJsonAndLock(
      detectPackageManager(context.root),
      context.root,
      projectRoot
    );
    await runCliBuild(context.root, projectRoot, options);
    yield { success: true };
  } finally {
    resetLocalFunction();

    if (childProcess) {
      childProcess.kill();
    }
  }
}

function runCliBuild(
  workspaceRoot: string,
  projectRoot: string,
  options: ExpoEasBuildOptions
) {
  return new Promise((resolve, reject) => {
    childProcess = fork(
      resolveEas(workspaceRoot),
      ['build', ...createBuildOptions(options)],
      {
        cwd: pathResolve(workspaceRoot, projectRoot),
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

function createBuildOptions(options: ExpoEasBuildOptions) {
  return Object.keys(options).reduce((acc, k) => {
    const v = options[k];
    if (typeof v === 'boolean') {
      if (k === 'interactive') {
        if (v === false) {
          acc.push('--non-interactive'); // when is false, the flag is --non-interactive
        }
      } else if (k === 'wait') {
        if (v === false) {
          acc.push('--no-wait'); // when is false, the flag is --no-wait
        } else {
          acc.push('--wait');
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

/**
 * This function:
 * - copies the root package.json and lock file to the project directory
 * - returns a function that resets the project package.json and removes the lock file
 */
function copyPackageJsonAndLock(
  packageManager: PackageManager,
  workspaceRoot: string,
  projectRoot: string
) {
  const packageJson = pathResolve(workspaceRoot, 'package.json');
  const rootPackageJson = readJsonFile<PackageJson>(packageJson);
  // do not copy package.json and lock file if workspaces are enabled
  if (
    (packageManager === 'pnpm' &&
      existsSync(pathResolve(workspaceRoot, 'pnpm-workspace.yaml'))) ||
    rootPackageJson.workspaces
  ) {
    return;
  }

  const packageJsonProject = pathResolve(projectRoot, 'package.json');
  const projectPackageJson = readJsonFile<PackageJson>(packageJsonProject);

  const lockFile = getLockFileName(detectPackageManager(workspaceRoot));
  const lockFileProject = pathResolve(projectRoot, lockFile);

  const rootPackageJsonDependencies = rootPackageJson.dependencies;
  const projectPackageJsonDependencies = { ...projectPackageJson.dependencies };

  const rootPackageJsonDevDependencies = rootPackageJson.devDependencies;
  const projectPackageJsonDevDependencies = {
    ...projectPackageJson.devDependencies,
  };

  projectPackageJson.dependencies = rootPackageJsonDependencies;
  projectPackageJson.devDependencies = rootPackageJsonDevDependencies;

  // Copy dependencies from root package.json to project package.json
  writeJsonFile(packageJsonProject, projectPackageJson);

  // Copy lock file from root to project
  copyFileSync(lockFile, lockFileProject);

  return () => {
    // Reset project package.json to original state
    projectPackageJson.dependencies = projectPackageJsonDependencies;
    projectPackageJson.devDependencies = projectPackageJsonDevDependencies;
    writeFileSync(
      packageJsonProject,
      JSON.stringify(projectPackageJson, null, 2)
    );

    // Remove lock file from project
    rmSync(lockFileProject, { recursive: true, force: true });
  };
}
