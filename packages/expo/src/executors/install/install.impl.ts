import { ExecutorContext, names } from '@nx/devkit';
import { readJsonFile } from 'nx/src/utils/fileutils';
import { ChildProcess, fork } from 'child_process';

import { ExpoInstallOptions } from './schema';
import { join } from 'path';
import {
  displayNewlyAddedDepsMessage,
  syncDeps,
} from '../sync-deps/sync-deps.impl';

export interface ExpoInstallOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* installExecutor(
  options: ExpoInstallOptions,
  context: ExecutorContext
): AsyncGenerator<ExpoInstallOutput> {
  try {
    await installAndUpdatePackageJson(context, options);
    yield {
      success: true,
    };
  } finally {
    if (childProcess) {
      childProcess.kill();
    }
  }
}

export async function installAndUpdatePackageJson(
  context: ExecutorContext,
  options: ExpoInstallOptions
) {
  const { installAsync } = require('@expo/cli/build/src/install/installAsync');

  const packages =
    typeof options.packages === 'string'
      ? options.packages.split(',')
      : options.packages ?? [];

  await installAsync(
    packages,
    {
      fix: options.fix,
      check: options.check,
    },
    createInstallOptions({ force: options.force })
  );

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
  displayNewlyAddedDepsMessage(
    context.projectName,
    await syncDeps(
      context.projectName,
      projectPackageJson,
      projectPackageJsonPath,
      workspacePackageJson,
      context.projectGraph,
      packages
    )
  );
}

// options from https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/install/index.ts
function createInstallOptions(options: ExpoInstallOptions) {
  return Object.keys(options).reduce((acc, k) => {
    const v = options[k];
    if (typeof v === 'boolean') {
      if (v === true) {
        // when true, does not need to pass the value true, just need to pass the flag in kebob case
        acc.push(`--${names(k).fileName}`);
      }
    } else if (v !== undefined) {
      acc.push(`--${names(k).fileName}`, v);
    }

    return acc;
  }, []);
}
