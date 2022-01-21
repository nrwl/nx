import {
  addDependenciesToPackageJson,
  updateJson,
  formatFiles,
  convertNxGenerator,
} from '@nrwl/devkit';
import type { Tree } from '@nrwl/devkit';
import { setDefaultCollection } from '@nrwl/workspace/src/utilities/set-default-collection';
import { initGenerator as nodeInitGenerator } from '@nrwl/node';
import {
  expressTypingsVersion,
  expressVersion,
  nxVersion,
} from '../../utils/versions';
import type { Schema } from './schema';

function updateDependencies(tree: Tree) {
  updateJson(tree, 'package.json', (json) => {
    delete json.dependencies['@nrwl/express'];
    return json;
  });
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
  setDefaultCollection(tree, '@nrwl/express');

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
