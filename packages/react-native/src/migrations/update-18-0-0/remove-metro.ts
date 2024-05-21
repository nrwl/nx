import {
  formatFiles,
  removeDependenciesFromPackageJson,
  Tree,
} from '@nx/devkit';

/**
 * Remove metro-* package since it is no longer explicity required in package.json.
 * react-native has dependency of @react-native/community-cli-plugin
 * @react-native/community-cli-plugin has dependency of metro
 *
 * Also remove @react-native-community/cli-* since it is a dependency of react-native.
 * (excpet reactNativeCommunityCliPlatformAndroidVersion because android files refer it by path)
 *
 * https://react-native-community.github.io/upgrade-helper/?from=0.72.6&to=0.73.1#RnDiffApp-package.json
 * @param tree
 * @returns
 */
export default async function update(tree: Tree) {
  removeDependenciesFromPackageJson(
    tree,
    [],
    [
      'metro',
      'metro-resolver',
      'metro-config',
      'metro-react-native-babel-preset',
      'metro-babel-register',
      'metro-react-native-babel-transformer',
      '@react-native-community/cli',
      '@react-native-community/cli-platform-ios',
    ]
  );
  await formatFiles(tree);
}
