import {
  formatFiles,
  GeneratorCallback,
  readJson,
  removeDependenciesFromPackageJson,
  Tree,
} from '@nrwl/devkit';

/**
 * For web/react apps with style scss option, remove node-sass sine it is deprecated.
 * We already include sass package in `@nrwl/web` deps so no need to install anything extra.
 */
export default async function update(tree: Tree) {
  const packageJson = readJson(tree, 'package.json');
  let task: undefined | GeneratorCallback = undefined;

  if (packageJson.devDependencies['node-sass']) {
    task = removeDependenciesFromPackageJson(tree, [], ['node-sass']);
  }

  if (packageJson.dependencies['node-sass']) {
    task = removeDependenciesFromPackageJson(tree, ['node-sass'], []);
  }

  if (task) await formatFiles(tree);

  return task;
}
