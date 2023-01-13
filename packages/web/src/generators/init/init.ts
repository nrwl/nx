import { cypressInitGenerator } from '@nrwl/cypress';
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
import {
  nxVersion,
  tsLibVersion,
  typesNodeVersion,
} from '../../utils/versions';
import { Schema } from './schema';
import { addBabelInputs } from '@nrwl/js/src/utils/add-babel-inputs';
import { jsInitGenerator } from '@nrwl/js';

function updateDependencies(tree: Tree, schema: Schema) {
  removeDependenciesFromPackageJson(tree, ['@nrwl/web'], []);

  const devDependencies = {
    '@nrwl/web': nxVersion,
    '@types/node': typesNodeVersion,
  };

  if (schema.bundler === 'webpack') {
    devDependencies['@nrwl/webpack'] = nxVersion;
  }

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
  let tasks: GeneratorCallback[] = [
    jsInitGenerator(tree, {
      skipPackageJson: schema.skipPackageJson,
      skipTsConfig: schema.skipTsConfig,
    }),
  ];

  if (!schema.unitTestRunner || schema.unitTestRunner === 'jest') {
    const jestTask = jestInitGenerator(tree, {
      skipPackageJson: schema.skipPackageJson,
    });
    tasks.push(jestTask);
  }
  if (!schema.e2eTestRunner || schema.e2eTestRunner === 'cypress') {
    const cypressTask = cypressInitGenerator(tree, {
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
