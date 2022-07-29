import { join } from 'path';
import * as chalk from 'chalk';
import {
  ExecutorContext,
  logger,
  readJsonFile,
  writeJsonFile,
  createProjectGraphAsync,
} from '@nrwl/devkit';

import { findAllNpmDependencies } from '../../utils/find-all-npm-dependencies';

import { ReactNativeSyncDepsOptions } from './schema';

export interface ReactNativeSyncDepsOutput {
  success: boolean;
}

export default async function* syncDepsExecutor(
  options: ReactNativeSyncDepsOptions,
  context: ExecutorContext
): AsyncGenerator<ReactNativeSyncDepsOutput> {
  const projectRoot = context.workspace.projects[context.projectName].root;
  displayNewlyAddedDepsMessage(
    context.projectName,
    await syncDeps(
      context.projectName,
      projectRoot,
      context.root,
      typeof options.include === 'string'
        ? options.include.split(',')
        : options.include,
      typeof options.exclude === 'string'
        ? options.exclude.split(',')
        : options.exclude
    )
  );

  yield { success: true };
}

export async function syncDeps(
  projectName: string,
  projectRoot: string,
  workspaceRoot: string,
  include: string[] = [],
  exclude: string[] = []
): Promise<string[]> {
  const graph = await createProjectGraphAsync();
  let npmDeps = findAllNpmDependencies(graph, projectName);
  const packageJsonPath = join(workspaceRoot, projectRoot, 'package.json');
  const packageJson = readJsonFile(packageJsonPath);
  const newDeps = [];
  let updated = false;

  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
    updated = true;
  }

  if (include && include.length) {
    npmDeps.push(...include);
  }
  if (exclude && exclude.length) {
    npmDeps = npmDeps.filter((dep) => !exclude.includes(dep));
  }

  npmDeps.forEach((dep) => {
    if (!packageJson.dependencies[dep]) {
      packageJson.dependencies[dep] = '*';
      newDeps.push(dep);
      updated = true;
    }
  });

  if (updated) {
    writeJsonFile(packageJsonPath, packageJson);
  }

  return newDeps;
}

export function displayNewlyAddedDepsMessage(
  projectName: string,
  deps: string[]
) {
  if (deps.length > 0) {
    logger.info(`${chalk.bold.cyan(
      'info'
    )} Added entries to 'package.json' for '${projectName}' (for autolink):
  ${deps.map((d) => chalk.bold.cyan(`"${d}": "*"`)).join('\n  ')}`);
  } else {
    logger.info(
      `${chalk.bold.cyan(
        'info'
      )} Dependencies for '${projectName}' are up to date! No changes made.`
    );
  }
}
