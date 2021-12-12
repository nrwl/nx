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
    {
      postcss: '^8.3.9',
      'postcss-import': '^14.0.2',
      'postcss-preset-env': '^6.7.0',
      'postcss-url': '^10.1.1',
    }
  );

  await formatFiles(tree);

  return task;
}
