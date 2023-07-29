import type { GeneratorCallback, Tree } from '@nx/devkit';
import { convertNxGenerator, formatFiles } from '@nx/devkit';
import { libraryGenerator as jsLibraryGenerator } from '@nx/js';
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
  await jsLibraryGenerator(tree, toJsLibraryGeneratorOptions(options));
  const installDepsTask = addDependencies(tree);
  deleteFiles(tree, options);
  createFiles(tree, options);
  addExportsToBarrelFile(tree, options);
  updateTsConfig(tree, options);
  addProject(tree, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installDepsTask;
}

export default libraryGenerator;

export const librarySchematic = convertNxGenerator(libraryGenerator);
