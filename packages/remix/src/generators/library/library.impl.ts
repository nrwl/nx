import type { Tree } from '@nx/devkit';
import { formatFiles, GeneratorCallback, runTasksInSerial } from '@nx/devkit';
import { Linter } from '@nx/eslint';
import { libraryGenerator } from '@nx/react';
import {
  addTsconfigEntryPoints,
  addUnitTestingSetup,
  normalizeOptions,
  updateBuildableConfig,
} from './lib';
import type { NxRemixGeneratorSchema } from './schema';

export async function remixLibraryGenerator(
  tree: Tree,
  schema: NxRemixGeneratorSchema
) {
  return remixLibraryGeneratorInternal(tree, { addPlugin: false, ...schema });
}

export async function remixLibraryGeneratorInternal(
  tree: Tree,
  schema: NxRemixGeneratorSchema
) {
  const tasks: GeneratorCallback[] = [];
  const options = await normalizeOptions(tree, schema);

  const libGenTask = await libraryGenerator(tree, {
    name: options.projectName,
    style: options.style,
    unitTestRunner: options.unitTestRunner,
    tags: options.tags,
    importPath: options.importPath,
    directory: options.projectRoot,
    projectNameAndRootFormat: 'as-provided',
    skipFormat: true,
    skipTsConfig: false,
    linter: Linter.EsLint,
    component: true,
    buildable: options.buildable,
    addPlugin: options.addPlugin,
  });
  tasks.push(libGenTask);

  if (options.unitTestRunner && options.unitTestRunner !== 'none') {
    const pkgInstallTask = addUnitTestingSetup(tree, options);
    tasks.push(pkgInstallTask);
  }

  addTsconfigEntryPoints(tree, options);

  if (options.buildable) {
    updateBuildableConfig(tree, options.projectName);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default remixLibraryGenerator;
