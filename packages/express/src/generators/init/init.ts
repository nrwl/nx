import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  removeDependenciesFromPackageJson,
  Tree,
} from '@nx/devkit';
import { initGenerator as nodeInitGenerator } from '@nx/node';
import { tslibVersion } from '@nx/node/src/utils/versions';
import {
  expressTypingsVersion,
  expressVersion,
  nxVersion,
} from '../../utils/versions';
import type { Schema } from './schema';

function updateDependencies(tree: Tree) {
  removeDependenciesFromPackageJson(tree, ['@nx/express'], []);

  return addDependenciesToPackageJson(
    tree,
    {
      express: expressVersion,
      tslib: tslibVersion,
    },
    {
      '@types/express': expressTypingsVersion,
      '@nx/express': nxVersion,
    }
  );
}

export async function initGenerator(tree: Tree, schema: Schema) {
  const initTask = await nodeInitGenerator(tree, {
    ...schema,
    skipFormat: true,
  });
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
