import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { addSwcDependencies } from '@nx/js/src/utils/swc/add-swc-dependencies';

import { Schema } from './schema';
import {
  nxVersion,
  reactRefreshVersion,
  reactRefreshWebpackPluginVersion,
  svgrWebpackVersion,
  swcLoaderVersion,
  tsLibVersion,
  urlLoaderVersion,
} from '../../utils/versions';
import { addBabelInputs } from '@nx/js/src/utils/add-babel-inputs';

export async function webpackInitGenerator(tree: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];
  const devDependencies = {
    '@nx/webpack': nxVersion,
  };

  if (schema.compiler === 'swc') {
    devDependencies['swc-loader'] = swcLoaderVersion;
    const addSwcTask = addSwcDependencies(tree);
    tasks.push(addSwcTask);
  }

  if (schema.compiler === 'tsc') {
    devDependencies['tslib'] = tsLibVersion;
  }

  if (schema.uiFramework === 'react') {
    devDependencies['@pmmmwh/react-refresh-webpack-plugin'] =
      reactRefreshWebpackPluginVersion;
    devDependencies['@svgr/webpack'] = svgrWebpackVersion;
    devDependencies['react-refresh'] = reactRefreshVersion;
    devDependencies['url-loader'] = urlLoaderVersion;
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  const baseInstalTask = addDependenciesToPackageJson(
    tree,
    {},
    devDependencies
  );
  tasks.push(baseInstalTask);

  return runTasksInSerial(...tasks);
}

export default webpackInitGenerator;

export const webpackInitSchematic = convertNxGenerator(webpackInitGenerator);
