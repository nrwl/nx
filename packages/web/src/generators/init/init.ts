import { cypressInitGenerator } from '@nrwl/cypress';
import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  readWorkspaceConfiguration,
  removeDependenciesFromPackageJson,
  Tree,
  updateWorkspaceConfiguration,
  writeJson,
} from '@nrwl/devkit';
import { jestInitGenerator } from '@nrwl/jest';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
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

function initRootBabelConfig(tree: Tree) {
  if (tree.exists('/babel.config.json') || tree.exists('/babel.config.js')) {
    return;
  }

  writeJson(tree, '/babel.config.json', {
    babelrcRoots: ['*'], // Make sure .babelrc files other than root can be loaded in a monorepo
  });

  const workspaceConfiguration = readWorkspaceConfiguration(tree);

  if (workspaceConfiguration.namedInputs?.sharedGlobals) {
    workspaceConfiguration.namedInputs.sharedGlobals.push(
      '{workspaceRoot}/babel.config.json'
    );
  }
  updateWorkspaceConfiguration(tree, workspaceConfiguration);
}

export async function webInitGenerator(tree: Tree, schema: Schema) {
  let tasks: GeneratorCallback[] = [];

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
  initRootBabelConfig(tree);
  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
  return runTasksInSerial(...tasks);
}

export default webInitGenerator;
export const webInitSchematic = convertNxGenerator(webInitGenerator);
