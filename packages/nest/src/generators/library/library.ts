import type { GeneratorCallback, Tree } from '@nrwl/devkit';
import { convertNxGenerator, formatFiles } from '@nrwl/devkit';
import { libraryGenerator as jsLibraryGenerator } from '@nrwl/js';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { addDependencies } from '../init/lib';
import {
  addExportsToBarrelFile,
  addProject,
  createFiles,
  deleteFiles,
  normalizeOptions,
  toJsLibraryGeneratorOptions,
  updateTsConfig,
} from './lib';
import type { LibraryGeneratorOptions } from './schema';

export async function libraryGenerator(
  tree: Tree,
  rawOptions: LibraryGeneratorOptions
): Promise<GeneratorCallback> {
  const options = normalizeOptions(tree, rawOptions);
  const jsLibraryTask = await jsLibraryGenerator(
    tree,
    toJsLibraryGeneratorOptions(options)
  );
  const installDepsTask = addDependencies(tree);
  deleteFiles(tree, options);
  createFiles(tree, options);
  addExportsToBarrelFile(tree, options);
  updateTsConfig(tree, options);
  addProject(tree, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(jsLibraryTask, installDepsTask);
}

export default libraryGenerator;

export const librarySchematic = convertNxGenerator(libraryGenerator);
