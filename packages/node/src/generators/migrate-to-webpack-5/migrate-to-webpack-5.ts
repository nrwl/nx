import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  logger,
  Tree,
} from '@nrwl/devkit';

const webpack5Packages = {
  'copy-webpack-plugin': '^9.0.0',
  'mini-css-extract-plugin': '^1.6.0',
  'source-map-loader': '^2.0.1',
  'terser-webpack-plugin': '^5.1.1',
  webpack: '^5.39.1',
  'webpack-dev-server': '^3.11.2',
  'webpack-merge': '^5.7.3',
  'webpack-node-externals': '^2.5.2',
  'webpack-sources': '^2.2.0',
};

export async function nodeMigrateToWebpack5Generator(tree: Tree, schema: {}) {
  logger.info(`NX Adding webpack 5 to workspace.`);
  return addDependenciesToPackageJson(tree, {}, webpack5Packages);
}

export default nodeMigrateToWebpack5Generator;
export const nodeMigrateToWebpack5Schematic = convertNxGenerator(
  nodeMigrateToWebpack5Generator
);
