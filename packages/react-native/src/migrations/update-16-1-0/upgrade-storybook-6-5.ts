import { Tree, updateJson } from '@nx/devkit';

/**
 * This migration is to upgrade storybook to 6.5.
 * - remove react-native-storybook-loader
 */
export default function update(tree: Tree) {
  if (tree.exists('package.json')) {
    updateJson(tree, 'package.json', (packageJson) => {
      if (packageJson.dependencies?.['react-native-storybook-loader']) {
        delete packageJson.dependencies['react-native-storybook-loader'];
      }
      if (packageJson.devDependencies?.['react-native-storybook-loader']) {
        delete packageJson.devDependencies['react-native-storybook-loader'];
      }
      return packageJson;
    });
  }
}
