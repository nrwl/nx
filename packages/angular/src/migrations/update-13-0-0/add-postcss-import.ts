import {
  addDependenciesToPackageJson,
  formatFiles,
  readJson,
  Tree,
} from '@nrwl/devkit';

export default async function (tree: Tree) {
  const { devDependencies } = readJson(tree, 'package.json');

  // Don't add if ng-packagr is not installed
  if (!devDependencies['ng-packagr']) {
    return;
  }

  const task = addDependenciesToPackageJson(
    tree,
    {},
    { 'postcss-import': '^14.0.2' }
  );

  await formatFiles(tree);

  return task;
}
