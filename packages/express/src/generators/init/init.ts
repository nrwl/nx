import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  removeDependenciesFromPackageJson,
  Tree,
} from '@nrwl/devkit';
import { initGenerator as nodeInitGenerator } from '@nrwl/node';
import {
  expressTypingsVersion,
  expressVersion,
  nxVersion,
} from '../../utils/versions';
import type { Schema } from './schema';

function updateDependencies(tree: Tree) {
  removeDependenciesFromPackageJson(tree, ['@nrwl/express'], []);

  return addDependenciesToPackageJson(
    tree,
    {
      express: expressVersion,
    },
    {
      '@types/express': expressTypingsVersion,
      '@nrwl/express': nxVersion,
    }
  );
}

export async function initGenerator(tree: Tree, schema: Schema) {
  const initTask = await nodeInitGenerator(tree, schema);
  const installTask = updateDependencies(tree);
  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return async () => {
    await initTask();
    await installTask();
  };
}

export default initGenerator;
export const initSchematic = convertNxGenerator(initGenerator);
