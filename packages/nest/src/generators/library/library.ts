import type { GeneratorCallback, Tree } from '@nx/devkit';
import { formatFiles, runTasksInSerial } from '@nx/devkit';
import { libraryGenerator as jsLibraryGenerator } from '@nx/js';
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
import initGenerator from '../init/init';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import { ensureDependencies } from '../../utils/ensure-dependencies';

export async function libraryGenerator(
  tree: Tree,
  rawOptions: LibraryGeneratorOptions
): Promise<GeneratorCallback> {
  return await libraryGeneratorInternal(tree, {
    addPlugin: false,
    projectNameAndRootFormat: 'derived',
    ...rawOptions,
  });
}

export async function libraryGeneratorInternal(
  tree: Tree,
  rawOptions: LibraryGeneratorOptions
): Promise<GeneratorCallback> {
  const options = await normalizeOptions(tree, rawOptions);
  await jsLibraryGenerator(tree, toJsLibraryGeneratorOptions(options));
  const initTask = await initGenerator(tree, rawOptions);
  const depsTask = ensureDependencies(tree);
  deleteFiles(tree, options);
  createFiles(tree, options);
  addExportsToBarrelFile(tree, options);
  updateTsConfig(tree, options);
  addProject(tree, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(
    ...[
      initTask,
      depsTask,
      () => {
        logShowProjectCommand(options.projectName);
      },
    ]
  );
}

export default libraryGenerator;
