import {
  formatFiles,
  GeneratorCallback,
  readJson,
  removeDependenciesFromPackageJson,
  Tree,
} from '@nrwl/devkit';

const packages = [
  'webpack',
  'copy-webpack-plugin',
  'webpack-merge',
  'webpack-node-externals',
  'mini-css-extract-plugin',
  'source-map-loader',
  'terser-webpack-plugin',
  'webpack-dev-server',
  'webpack-sources',
  'react-refresh',
  '@pmmmwh/react-refresh-webpack-plugin',
];

export default async function update(tree: Tree) {
  const packageJson = readJson(tree, 'package.json');
  let task: undefined | GeneratorCallback = undefined;

  // Undo the install by `nx g @nrwl/web:webpack5` in Nx 12.
  if (
    packageJson.devDependencies['webpack']?.match(/^([\^~])?5\./) &&
    packages.every((p) => packageJson.devDependencies[p])
  ) {
    task = removeDependenciesFromPackageJson(tree, [], packages);
    await formatFiles(tree);
  }

  return task;
}
