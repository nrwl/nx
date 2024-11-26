import {
  addDependenciesToPackageJson,
  runTasksInSerial,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { addSwcDependencies } from '@nx/js/src/utils/swc/add-swc-dependencies';
import {
  reactRefreshVersion,
  reactRefreshWebpackPluginVersion,
  svgrWebpackVersion,
  swcLoaderVersion,
  tsLibVersion,
} from './versions';

export type EnsureDependenciesOptions = {
  compiler?: 'swc' | 'tsc';
  uiFramework?: 'none' | 'react';
};

export function ensureDependencies(
  tree: Tree,
  options: EnsureDependenciesOptions
) {
  const tasks: GeneratorCallback[] = [];
  const devDependencies: Record<string, string> = {};

  if (options.compiler === 'swc') {
    devDependencies['swc-loader'] = swcLoaderVersion;
    const addSwcTask = addSwcDependencies(tree);
    tasks.push(addSwcTask);
  }

  if (options.compiler === 'tsc') {
    devDependencies['tslib'] = tsLibVersion;
  }

  if (options.uiFramework === 'react') {
    devDependencies['@pmmmwh/react-refresh-webpack-plugin'] =
      reactRefreshWebpackPluginVersion;
    devDependencies['@svgr/webpack'] = svgrWebpackVersion;
    devDependencies['react-refresh'] = reactRefreshVersion;
  }

  tasks.push(addDependenciesToPackageJson(tree, {}, devDependencies));

  return runTasksInSerial(...tasks);
}
