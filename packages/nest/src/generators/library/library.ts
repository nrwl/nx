import type { GeneratorCallback, Tree } from '@nx/devkit';
import {
  formatFiles,
  joinPathFragments,
  readJson,
  runTasksInSerial,
  writeJson,
} from '@nx/devkit';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import { libraryGenerator as jsLibraryGenerator } from '@nx/js';
import { ensureDependencies } from '../../utils/ensure-dependencies';
import initGenerator from '../init/init';
import {
  addExportsToBarrelFile,
  addProject,
  createFiles,
  deleteFiles,
  normalizeOptions,
  toJsLibraryGeneratorOptions,
  updateTsConfig,
} from './lib';
import type { LibraryGeneratorOptions, NormalizedOptions } from './schema';

export async function libraryGenerator(
  tree: Tree,
  rawOptions: LibraryGeneratorOptions
): Promise<GeneratorCallback> {
  return await libraryGeneratorInternal(tree, {
    addPlugin: false,
    ...rawOptions,
  });
}

export async function libraryGeneratorInternal(
  tree: Tree,
  rawOptions: LibraryGeneratorOptions
): Promise<GeneratorCallback> {
  const options = await normalizeOptions(tree, rawOptions);
  const jsLibraryTask = await jsLibraryGenerator(
    tree,
    toJsLibraryGeneratorOptions(options)
  );
  updatePackageJson(tree, options);
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
      jsLibraryTask,
      initTask,
      depsTask,
      () => {
        logShowProjectCommand(options.projectName);
      },
    ]
  );
}

export default libraryGenerator;

function updatePackageJson(tree: Tree, options: NormalizedOptions) {
  const packageJsonPath = joinPathFragments(
    options.projectRoot,
    'package.json'
  );
  if (!tree.exists(packageJsonPath)) {
    return;
  }

  const packageJson = readJson(tree, packageJsonPath);

  if (packageJson.type === 'module') {
    // The @nx/js:lib generator can set the type to 'module' which would
    // potentially break consumers of the library.
    delete packageJson.type;
  }

  writeJson(tree, packageJsonPath, packageJson);
}
