import {
  formatFiles,
  removeDependenciesFromPackageJson,
  Tree,
} from '@nx/devkit';

/**
 * Remove @types/react-native package since it is no longer required. It would be a part of react native package.
 * @param tree
 * @returns
 */
export default async function update(tree: Tree) {
  removeDependenciesFromPackageJson(tree, [], ['@types/react-native']);
  await formatFiles(tree);
}
