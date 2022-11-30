import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
  writeJson,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { swcCoreVersion } from '@nrwl/js/src/utils/versions';

import { Schema } from './schema';
import {
  reactRefreshVersion,
  reactRefreshWebpackPluginVersion,
  svgrWebpackVersion,
  swcHelpersVersion,
  swcLoaderVersion,
  tsLibVersion,
  tsQueryVersion,
  urlLoaderVersion,
} from '../../utils/versions';

export async function webpackInitGenerator(tree: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  if (schema.compiler === 'babel') {
    initRootBabelConfig(tree);
  }

  if (schema.compiler === 'swc') {
    const swcInstallTask = addDependenciesToPackageJson(
      tree,
      {},
      {
        '@swc/helpers': swcHelpersVersion,
        '@swc/core': swcCoreVersion,
        'swc-loader': swcLoaderVersion,
      }
    );
    tasks.push(swcInstallTask);
  }

  if (schema.compiler === 'tsc') {
    const tscInstallTask = addDependenciesToPackageJson(
      tree,
      {},
      { tslib: tsLibVersion }
    );
    tasks.push(tscInstallTask);
  }

  if (schema.uiFramework === 'react') {
    const reactInstallTask = addDependenciesToPackageJson(
      tree,
      {},
      {
        '@pmmmwh/react-refresh-webpack-plugin':
          reactRefreshWebpackPluginVersion,
        '@phenomnomnominal/tsquery': tsQueryVersion,
        '@svgr/webpack': svgrWebpackVersion,
        'react-refresh': reactRefreshVersion,
        'url-loader': urlLoaderVersion,
      }
    );
    tasks.push(reactInstallTask);
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
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

export default webpackInitGenerator;

export const webpackInitSchematic = convertNxGenerator(webpackInitGenerator);
