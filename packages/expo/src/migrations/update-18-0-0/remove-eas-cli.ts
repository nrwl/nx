import {
  formatFiles,
  removeDependenciesFromPackageJson,
  Tree,
} from '@nx/devkit';

/**
 * Remove eas-cli from dev dependencies.
 * Use globally eas-cli.
 *
 * Remove metro and metro-resolver from dev dependencies.
 * react-native has dependency of @react-native/community-cli-plugin
 * @react-native/community-cli-plugin has dependency of metro
 * @param tree
 * @returns
 */
export default async function update(tree: Tree) {
  removeDependenciesFromPackageJson(
    tree,
    [],
    ['eas-cli', 'metro', 'metro-resolver']
  );
  await formatFiles(tree);
}
