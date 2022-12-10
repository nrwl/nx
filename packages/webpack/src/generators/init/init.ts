import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  Tree,
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
  urlLoaderVersion,
} from '../../utils/versions';
import { addBabelInputs } from '@nrwl/js/src/utils/add-babel-inputs';

export async function webpackInitGenerator(tree: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  if (schema.compiler === 'babel') {
    addBabelInputs(tree);
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

export default webpackInitGenerator;

export const webpackInitSchematic = convertNxGenerator(webpackInitGenerator);
