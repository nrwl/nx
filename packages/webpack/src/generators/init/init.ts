import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  readNxJson,
  runTasksInSerial,
  Tree,
  updateNxJson,
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
  webpackCliVersion,
} from '../../utils/versions';
import { WebpackPluginOptions } from '../../plugins/plugin';

export async function webpackInitGenerator(tree: Tree, schema: Schema) {
  const shouldAddPlugin = process.env.NX_PCV3 === 'true';
  const tasks: GeneratorCallback[] = [];

  if (shouldAddPlugin) {
    addPlugin(tree);
  }

  if (!schema.skipPackageJson) {
    const devDependencies = {
      '@nx/webpack': nxVersion,
    };

    if (shouldAddPlugin) {
      devDependencies['webpack-cli'] = webpackCliVersion;
    }

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

    const baseInstallTask = addDependenciesToPackageJson(
      tree,
      {},
      devDependencies
    );
    tasks.push(baseInstallTask);
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

function addPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);
  nxJson.plugins ??= [];

  for (const plugin of nxJson.plugins) {
    if (
      typeof plugin === 'string'
        ? plugin === '@nx/webpack/plugin'
        : plugin.plugin === '@nx/webpack/plugin'
    ) {
      return;
    }
  }

  nxJson.plugins.push({
    plugin: '@nx/webpack/plugin',
    options: {
      buildTargetName: 'build',
      serveTargetName: 'serve',
      previewTargetName: 'preview',
    } as WebpackPluginOptions,
  });
  updateNxJson(tree, nxJson);
}

export default webpackInitGenerator;
