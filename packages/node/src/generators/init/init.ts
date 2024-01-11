import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  removeDependenciesFromPackageJson,
  Tree,
} from '@nx/devkit';

import {
  nxVersion,
  tslibVersion,
  typesNodeVersion,
} from '../../utils/versions';
import { Schema } from './schema';

function updateDependencies(tree: Tree) {
  removeDependenciesFromPackageJson(tree, ['@nx/node'], []);

  return addDependenciesToPackageJson(
    tree,
    {
      tslib: tslibVersion,
    },
    { '@nx/node': nxVersion, '@types/node': typesNodeVersion }
  );
}

export async function initGenerator(tree: Tree, options: Schema) {
  let installTask: GeneratorCallback = () => {};
  if (!options.skipPackageJson) {
    installTask = updateDependencies(tree);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

export default initGenerator;
