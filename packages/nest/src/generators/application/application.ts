import type { GeneratorCallback, Tree } from '@nx/devkit';
import { formatFiles, runTasksInSerial } from '@nx/devkit';
import { applicationGenerator as nodeApplicationGenerator } from '@nx/node';

import { initGenerator } from '../init/init';
import {
  createFiles,
  normalizeOptions,
  toNodeApplicationGeneratorOptions,
  updateTsConfig,
} from './lib';
import type { ApplicationGeneratorOptions } from './schema';

export async function applicationGenerator(
  tree: Tree,
  rawOptions: ApplicationGeneratorOptions
): Promise<GeneratorCallback> {
  return await applicationGeneratorInternal(tree, {
    projectNameAndRootFormat: 'derived',
    ...rawOptions,
  });
}

export async function applicationGeneratorInternal(
  tree: Tree,
  rawOptions: ApplicationGeneratorOptions
): Promise<GeneratorCallback> {
  const options = await normalizeOptions(tree, rawOptions);
  const initTask = await initGenerator(tree, {
    skipPackageJson: options.skipPackageJson,
    skipFormat: true,
  });
  const nodeApplicationTask = await nodeApplicationGenerator(
    tree,
    toNodeApplicationGeneratorOptions(options)
  );
  createFiles(tree, options);
  updateTsConfig(tree, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(initTask, nodeApplicationTask);
}

export default applicationGenerator;
