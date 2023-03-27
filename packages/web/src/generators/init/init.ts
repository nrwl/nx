import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  ensurePackage,
  formatFiles,
  GeneratorCallback,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
} from '@nrwl/devkit';

import { addBabelInputs } from '@nrwl/js/src/utils/add-babel-inputs';
import { initGenerator as jsInitGenerator } from '@nrwl/js';
import {
  nxVersion,
  tsLibVersion,
  typesNodeVersion,
} from '../../utils/versions';
import { Schema } from './schema';

function updateDependencies(tree: Tree, schema: Schema) {
  removeDependenciesFromPackageJson(tree, ['@nrwl/web'], []);

  const devDependencies = {
    '@nrwl/web': nxVersion,
    '@types/node': typesNodeVersion,
  };

  return addDependenciesToPackageJson(
    tree,
    {
      'core-js': '^3.6.5',
      'regenerator-runtime': '0.13.7',
      tslib: tsLibVersion,
    },
    devDependencies
  );
}

export async function webInitGenerator(tree: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  const jsInitTask = await jsInitGenerator(tree, {
    js: false,
    skipFormat: true,
  });
  tasks.push(jsInitTask);

  if (!schema.unitTestRunner || schema.unitTestRunner === 'jest') {
    const { jestInitGenerator } = await ensurePackage('@nrwl/jest', nxVersion);
    const jestTask = await jestInitGenerator(tree, {
      skipPackageJson: schema.skipPackageJson,
    });
    tasks.push(jestTask);
  }
  if (!schema.e2eTestRunner || schema.e2eTestRunner === 'cypress') {
    const { cypressInitGenerator } = await ensurePackage(
      '@nrwl/cypress',
      nxVersion
    );
    const cypressTask = await cypressInitGenerator(tree, {
      skipPackageJson: schema.skipPackageJson,
    });
    tasks.push(cypressTask);
  }
  if (!schema.skipPackageJson) {
    const installTask = updateDependencies(tree, schema);
    tasks.push(installTask);
  }
  addBabelInputs(tree);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
  return runTasksInSerial(...tasks);
}

export default webInitGenerator;
export const webInitSchematic = convertNxGenerator(webInitGenerator);
