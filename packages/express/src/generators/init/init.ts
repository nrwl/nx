import {
  addDependenciesToPackageJson,
  Tree,
  updateJson,
  formatFiles,
  convertNxGenerator,
} from '@nrwl/devkit';

import { setDefaultCollection } from '@nrwl/workspace/src/utilities/set-default-collection';

import { initGenerator as nodeInitGenerator } from '@nrwl/node';

import {
  expressTypingsVersion,
  expressVersion,
  nxVersion,
} from '../../utils/versions';
import { Schema } from './schema';

function removeNrwlExpressFromDeps(tree: Tree) {
  updateJson(tree, 'package.json', (json) => {
    delete json.dependencies['@nrwl/express'];
    return json;
  });
}

export async function initGenerator(tree: Tree, schema: Schema) {
  setDefaultCollection(tree, '@nrwl/express');

  const initTask = await nodeInitGenerator(tree, {
    unitTestRunner: schema.unitTestRunner,
    skipFormat: true,
  });
  removeNrwlExpressFromDeps(tree);
  const installTask = addDependenciesToPackageJson(
    tree,
    {
      express: expressVersion,
      tslib: '^2.0.0',
    },
    {
      '@types/express': expressTypingsVersion,
      '@nrwl/express': nxVersion,
    }
  );
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
