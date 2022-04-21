import { cypressInitGenerator } from '@nrwl/cypress';
import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  removeDependenciesFromPackageJson,
  Tree,
  updateJson,
  writeJson,
} from '@nrwl/devkit';
import { jestInitGenerator } from '@nrwl/jest';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { setDefaultCollection } from '@nrwl/workspace/src/utilities/set-default-collection';
import { nxVersion, typesNodeVersion } from '../../utils/versions';
import { Schema } from './schema';

function updateDependencies(tree: Tree) {
  removeDependenciesFromPackageJson(tree, ['@nrwl/web'], []);

  return addDependenciesToPackageJson(
    tree,
    {
      'core-js': '^3.6.5',
      'regenerator-runtime': '0.13.7',
      tslib: '^2.0.0',
    },
    {
      '@nrwl/web': nxVersion,
      '@types/node': typesNodeVersion,
    }
  );
}

function initRootBabelConfig(tree: Tree) {
  if (tree.exists('/babel.config.js')) {
    return;
  }

  if (tree.exists('/babel.config.json')) {
    // make sure we have the babel typescript preset
    updateJson(tree, '/babel.config.json', (json) => {
      json.presets = json.presets || [];

      if (!json.presets.includes('@babel/preset-typescript')) {
        json.presets.push('@babel/preset-typescript');
      }
      return json;
    });
  } else {
    writeJson(tree, '/babel.config.json', {
      babelrcRoots: ['*'], // Make sure .babelrc files other than root can be loaded in a monorepo
      presets: ['@babel/preset-typescript'],
    });
  }
}

export async function webInitGenerator(tree: Tree, schema: Schema) {
  let tasks: GeneratorCallback[] = [];

  setDefaultCollection(tree, '@nrwl/web');
  if (!schema.unitTestRunner || schema.unitTestRunner === 'jest') {
    const jestTask = jestInitGenerator(tree, {});
    tasks.push(jestTask);
  }
  if (!schema.e2eTestRunner || schema.e2eTestRunner === 'cypress') {
    const cypressTask = cypressInitGenerator(tree, {});
    tasks.push(cypressTask);
  }
  const installTask = updateDependencies(tree);
  tasks.push(installTask);
  initRootBabelConfig(tree);
  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
  return runTasksInSerial(...tasks);
}

export default webInitGenerator;
export const webInitSchematic = convertNxGenerator(webInitGenerator);
