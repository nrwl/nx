import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  removeDependenciesFromPackageJson,
  Tree,
} from '@nrwl/devkit';
import { jestInitGenerator } from '@nrwl/jest';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { jsInitGenerator } from '@nrwl/js';
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

  const tasks: GeneratorCallback[] = [
    jsInitGenerator(tree, {
      skipPackageJson: schema.skipPackageJson,
      skipTsConfig: schema.skipTsConfig,
    }),
  ];
  if (options.unitTestRunner === 'jest') {
    tasks.push(jestInitGenerator(tree, schema));
  }

  if (!options.skipPackageJson) {
    tasks.push(updateDependencies(tree));
  }
  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default initGenerator;
export const initSchematic = convertNxGenerator(initGenerator);
