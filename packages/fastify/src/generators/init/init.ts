import type { GeneratorCallback, Tree } from '@nrwl/devkit';
import { convertNxGenerator, formatFiles } from '@nrwl/devkit';
import { initGenerator as nodeInitGenerator } from '@nrwl/node';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { setDefaultCollection } from '@nrwl/workspace/src/utilities/set-default-collection';
import { addDependencies, normalizeOptions } from './lib';
import type { InitGeneratorOptions } from './schema';

export async function initGenerator(
  tree: Tree,
  rawOptions: InitGeneratorOptions
): Promise<GeneratorCallback> {
  const options = normalizeOptions(rawOptions);
  setDefaultCollection(tree, '@nrwl/fastify');
  const nodeInitTask = await nodeInitGenerator(tree, options);
  const installPackagesTask = addDependencies(tree);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(nodeInitTask, installPackagesTask);
}

export default initGenerator;

export const initSchematic = convertNxGenerator(initGenerator);
