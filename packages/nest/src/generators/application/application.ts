import type { GeneratorCallback, Tree } from '@nx/devkit';
import { formatFiles, runTasksInSerial } from '@nx/devkit';
import { assertNotUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { applicationGenerator as nodeApplicationGenerator } from '@nx/node';

import { initGenerator } from '../init/init';
import {
  createFiles,
  normalizeOptions,
  toNodeApplicationGeneratorOptions,
  updateTsConfig,
} from './lib';
import type { ApplicationGeneratorOptions } from './schema';
import { ensureDependencies } from '../../utils/ensure-dependencies';

export async function applicationGenerator(
  tree: Tree,
  rawOptions: ApplicationGeneratorOptions
): Promise<GeneratorCallback> {
  return await applicationGeneratorInternal(tree, {
    addPlugin: false,
    ...rawOptions,
  });
}

export async function applicationGeneratorInternal(
  tree: Tree,
  rawOptions: ApplicationGeneratorOptions
): Promise<GeneratorCallback> {
  assertNotUsingTsSolutionSetup(tree, 'nest', 'application');

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
    tasks.push(ensureDependencies(tree));
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default applicationGenerator;
