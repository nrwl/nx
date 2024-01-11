import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  removeDependenciesFromPackageJson,
  Tree,
} from '@nx/devkit';
import {
  nxVersion,
  tsLibVersion,
  typesNodeVersion,
} from '../../utils/versions';
import { Schema } from './schema';

function updateDependencies(tree: Tree) {
  removeDependenciesFromPackageJson(tree, ['@nx/web'], []);

  const devDependencies = {
    '@nx/web': nxVersion,
    '@types/node': typesNodeVersion,
  };

  return addDependenciesToPackageJson(
    tree,
    {
      tslib: tsLibVersion,
    },
    devDependencies
  );
}

export async function webInitGenerator(tree: Tree, schema: Schema) {
  let installTask: GeneratorCallback = () => {};
  if (!schema.skipPackageJson) {
    installTask = updateDependencies(tree);
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

export default webInitGenerator;
