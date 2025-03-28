import type { Tree } from '@nx/devkit';
import { formatFiles, GeneratorCallback, runTasksInSerial } from '@nx/devkit';
import { initGenerator as jsInitGenerator } from '@nx/js';
import { libraryGenerator } from '@nx/react';
import {
  addTsconfigEntryPoints,
  addUnitTestingSetup,
  normalizeOptions,
  updateBuildableConfig,
} from './lib';
import type { NxRemixGeneratorSchema } from './schema';
import {
  addProjectToTsSolutionWorkspace,
  updateTsconfigFiles,
} from '@nx/js/src/utils/typescript/ts-solution-setup';
import { sortPackageJsonFields } from '@nx/js/src/utils/package-json/sort-fields';

export async function remixLibraryGenerator(
  tree: Tree,
  schema: NxRemixGeneratorSchema
) {
  return remixLibraryGeneratorInternal(tree, {
    addPlugin: false,
    useProjectJson: true,
    ...schema,
  });
}

export async function remixLibraryGeneratorInternal(
  tree: Tree,
  schema: NxRemixGeneratorSchema
) {
  const tasks: GeneratorCallback[] = [];
  const options = await normalizeOptions(tree, schema);

  if (options.isUsingTsSolutionConfig) {
    await addProjectToTsSolutionWorkspace(tree, options.projectRoot);
  }

  const jsInitTask = await jsInitGenerator(tree, {
    js: options.js,
    skipFormat: true,
  });
  tasks.push(jsInitTask);

  const libGenTask = await libraryGenerator(tree, {
    directory: options.directory,
    name: options.name,
    style: options.style,
    unitTestRunner: options.unitTestRunner,
    tags: options.tags,
    importPath: options.importPath,
    skipFormat: true,
    skipTsConfig: false,
    linter: options.linter,
    component: true,
    buildable: options.buildable,
    bundler: options.bundler,
    addPlugin: options.addPlugin,
    useProjectJson: options.useProjectJson,
  });
  tasks.push(libGenTask);

  if (options.unitTestRunner && options.unitTestRunner !== 'none') {
    const pkgInstallTask = addUnitTestingSetup(tree, options);
    tasks.push(pkgInstallTask);
  }

  addTsconfigEntryPoints(tree, options);

  if (options.bundler === 'rollup' || options.buildable) {
    updateBuildableConfig(tree, options);
  }

  updateTsconfigFiles(
    tree,
    options.projectRoot,
    'tsconfig.lib.json',
    {
      jsx: 'react-jsx',
      module: 'esnext',
      moduleResolution: 'bundler',
    },
    options.linter === 'eslint'
      ? ['eslint.config.js', 'eslint.config.cjs', 'eslint.config.mjs']
      : undefined
  );

  sortPackageJsonFields(tree, options.projectRoot);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default remixLibraryGenerator;
