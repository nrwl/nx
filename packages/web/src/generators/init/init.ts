import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  readWorkspaceConfiguration,
  Tree,
  updateJson,
  updateWorkspaceConfiguration,
  writeJson,
} from '@nrwl/devkit';
import { Schema } from './schema';
import {
  documentRegisterElementVersion,
  nxVersion,
} from '../../utils/versions';
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
      'document-register-element': documentRegisterElementVersion,
      tslib: '^2.0.0',
    },
    {
      '@nrwl/web': nxVersion,
    }
  );
}

function setDefaultCollection(tree: Tree) {
  const workspace = readWorkspaceConfiguration(tree);
  workspace.cli = workspace.cli || {};

  const defaultCollection = workspace.cli.defaultCollection;

  if (!defaultCollection || defaultCollection === '@nrwl/workspace') {
    workspace.cli.defaultCollection = '@nrwl/web';
  }

  updateWorkspaceConfiguration(tree, workspace);
}

function initRootBabelConfig(tree: Tree) {
  if (tree.exists('/babel.config.json') || tree.exists('/babel.config.js')) {
    return;
  }

  writeJson(tree, '/babel.config.json', {
    presets: ['@nrwl/web/babel'],
    babelrcRoots: ['*'], // Make sure .babelrc files other than root can be loaded in a monorepo
  });
}

export async function webInitGenerator(tree: Tree, schema: Schema) {
  let installTask: GeneratorCallback;

  setDefaultCollection(tree);
  if (!schema.unitTestRunner || schema.unitTestRunner === 'jest') {
    installTask = jestInitGenerator(tree, {});
  }
  if (!schema.e2eTestRunner || schema.e2eTestRunner === 'cypress') {
    installTask = cypressInitGenerator(tree) || installTask;
  }
  installTask = updateDependencies(tree) || installTask;
  initRootBabelConfig(tree);
  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
  return installTask;
}

export default webInitGenerator;
export const webInitSchematic = convertNxGenerator(webInitGenerator);
