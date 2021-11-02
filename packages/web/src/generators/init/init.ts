import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  Tree,
  updateJson,
  writeJson,
} from '@nrwl/devkit';
import { setDefaultCollection } from '@nrwl/workspace/src/utilities/set-default-collection';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { Schema } from './schema';
import { nxVersion } from '../../utils/versions';
import { cypressInitGenerator } from '@nrwl/cypress';
import { jestInitGenerator } from '@nrwl/jest';

function updateDependencies(tree: Tree) {
  updateJson(tree, 'package.json', (json) => {
    delete json.dependencies['@nrwl/web'];
    return json;
  });

  return addDependenciesToPackageJson(
    tree,
    {
      'core-js': '^3.6.5',
      'regenerator-runtime': '0.13.7',
      tslib: '^2.0.0',
    },
    {
      '@nrwl/web': nxVersion,
    }
  );
}

function initRootBabelConfig(tree: Tree) {
  if (tree.exists('/babel.config.json') || tree.exists('/babel.config.js')) {
    return;
  }

  writeJson(tree, '/babel.config.json', {
    babelrcRoots: ['*'], // Make sure .babelrc files other than root can be loaded in a monorepo
  });
}

export async function webInitGenerator(tree: Tree, schema: Schema) {
  let tasks: GeneratorCallback[] = [];

  setDefaultCollection(tree, '@nrwl/web');
  if (!schema.unitTestRunner || schema.unitTestRunner === 'jest') {
    const jestTask = jestInitGenerator(tree, {});
    tasks.push(jestTask);
  }
  if (!schema.e2eTestRunner || schema.e2eTestRunner === 'cypress') {
    const cypressTask = cypressInitGenerator(tree);
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
