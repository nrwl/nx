import type { GeneratorCallback, Tree } from '@nrwl/devkit';
import {
  convertNxGenerator,
  formatFiles,
  runTasksInSerial,
} from '@nrwl/devkit';
import { initGenerator as nodeInitGenerator } from '@nrwl/node';

import { addDependencies, normalizeOptions } from './lib';
import type { InitGeneratorOptions } from './schema';

export async function initGenerator(
  tree: Tree,
  rawOptions: InitGeneratorOptions
): Promise<GeneratorCallback> {
  const options = normalizeOptions(rawOptions);
  const tasks: GeneratorCallback[] = [];

  const nodeInitTask = await nodeInitGenerator(tree, options);
  tasks.push(nodeInitTask);

  if (!options.skipPackageJson) {
    const installPackagesTask = addDependencies(tree);
    tasks.push(installPackagesTask);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default initGenerator;

export const initSchematic = convertNxGenerator(initGenerator);
