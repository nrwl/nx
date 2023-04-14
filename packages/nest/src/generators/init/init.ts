import type { GeneratorCallback, Tree } from '@nx/devkit';
import { convertNxGenerator, formatFiles, runTasksInSerial } from '@nx/devkit';
import { initGenerator as nodeInitGenerator } from '@nx/node';

import { addDependencies, normalizeOptions } from './lib';
import type { InitGeneratorOptions } from './schema';

export async function initGenerator(
  tree: Tree,
  rawOptions: InitGeneratorOptions
): Promise<GeneratorCallback> {
  const options = normalizeOptions(rawOptions);
  const tasks: GeneratorCallback[] = [];

  const nodeInitTask = await nodeInitGenerator(tree, {
    ...options,
    skipFormat: true,
  });
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
