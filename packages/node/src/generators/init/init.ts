import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
} from '@nrwl/devkit';
import { jestInitGenerator } from '@nrwl/jest';

import { initGenerator as jsInitGenerator } from '@nrwl/js';
import {
  nxVersion,
  tslibVersion,
  typesNodeVersion,
} from '../../utils/versions';
import { Schema } from './schema';

function updateDependencies(tree: Tree) {
  removeDependenciesFromPackageJson(tree, ['@nrwl/node'], []);

  return addDependenciesToPackageJson(
    tree,
    {
      tslib: tslibVersion,
    },
    { '@nrwl/node': nxVersion, '@types/node': typesNodeVersion }
  );
}

function normalizeOptions(schema: Schema) {
  return {
    ...schema,
    unitTestRunner: schema.unitTestRunner ?? 'jest',
  };
}

export async function initGenerator(tree: Tree, schema: Schema) {
  const options = normalizeOptions(schema);

  const tasks: GeneratorCallback[] = [];
  tasks.push(
    await jsInitGenerator(tree, {
      ...schema,
      tsConfigName: schema.rootProject ? 'tsconfig.json' : 'tsconfig.base.json',
      skipFormat: true,
    })
  );
  if (options.unitTestRunner === 'jest') {
    tasks.push(
      await jestInitGenerator(tree, { ...schema, testEnvironment: 'node' })
    );
  }

  tasks.push(updateDependencies(tree));

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default initGenerator;
export const initSchematic = convertNxGenerator(initGenerator);
