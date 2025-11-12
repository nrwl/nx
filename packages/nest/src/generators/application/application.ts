import type { GeneratorCallback, Tree } from '@nx/devkit';
import { formatFiles, runTasksInSerial } from '@nx/devkit';
import { applicationGenerator as nodeApplicationGenerator } from '@nx/node';

import { initGenerator } from '../init/init.js';
import {
  createFiles,
  normalizeOptions,
  toNodeApplicationGeneratorOptions,
  updateTsConfig,
} from './lib/index.js';
import type { ApplicationGeneratorOptions } from './schema';
import { ensureDependencies } from '../../utils/ensure-dependencies.js';

export async function applicationGenerator(
  tree: Tree,
  rawOptions: ApplicationGeneratorOptions
): Promise<GeneratorCallback> {
  return await applicationGeneratorInternal(tree, {
    addPlugin: false,
    useProjectJson: true,
    ...rawOptions,
  });
}

export async function applicationGeneratorInternal(
  tree: Tree,
  rawOptions: ApplicationGeneratorOptions
): Promise<GeneratorCallback> {
  const options = await normalizeOptions(tree, rawOptions);

  const tasks: GeneratorCallback[] = [];
  const initTask = await initGenerator(tree, {
    skipPackageJson: options.skipPackageJson,
    skipFormat: true,
  });
  tasks.push(initTask);
  const nodeApplicationTask = await nodeApplicationGenerator(
    tree,
    toNodeApplicationGeneratorOptions(options)
  );
  tasks.push(nodeApplicationTask);
  createFiles(tree, options);
  updateTsConfig(tree, options);

  if (!options.skipPackageJson) {
    // Install dependencies to root package.json
    tasks.push(ensureDependencies(tree));

    // Install dependencies to project's package.json (for PM Workspaces)
    if (tree.exists(`${options.appProjectRoot}/package.json`)) {
      tasks.push(ensureDependencies(tree, options.appProjectRoot));
    }
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default applicationGenerator;
