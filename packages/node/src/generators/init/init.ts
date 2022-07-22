import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  removeDependenciesFromPackageJson,
  Tree,
} from '@nrwl/devkit';
import { jestInitGenerator } from '@nrwl/jest';
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

  let jestInstall: GeneratorCallback;
  if (options.unitTestRunner === 'jest') {
    jestInstall = await jestInitGenerator(tree, schema);
  }
  const installTask = await updateDependencies(tree);
  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return async () => {
    if (jestInstall) {
      await jestInstall();
    }
    await installTask();
  };
}

export default initGenerator;
export const initSchematic = convertNxGenerator(initGenerator);
