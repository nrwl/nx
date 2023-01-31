import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  Tree,
} from '@nrwl/devkit';
import { swcCoreVersion } from '@nrwl/js/src/utils/versions';

import { Schema } from './schema';
import {
  nxVersion,
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
  if (schema.compiler === 'babel') {
    addBabelInputs(tree);
  }
  const devDependencies = {
    '@nrwl/webpack': nxVersion,
  };

  if (schema.compiler === 'swc') {
    devDependencies['@swc/helpers'] = swcHelpersVersion;
    devDependencies['@swc/core'] = swcCoreVersion;
    devDependencies['swc-loader'] = swcLoaderVersion;
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

  return addDependenciesToPackageJson(tree, {}, devDependencies);
}

export default webpackInitGenerator;

export const webpackInitSchematic = convertNxGenerator(webpackInitGenerator);
