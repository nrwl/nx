import { Tree, updateJson } from '@nx/devkit';

/**
 * This migration is to upgrade storybook to 6.5.
 * - remove react-native-storybook-loader
 * - change .storybook/story-loader.js to .storybook/story-loader.ts
 */
export function update(tree: Tree) {
  updateJson(tree, 'package.json', (packageJson) => {
    delete packageJson.devDependencies['react-native-storybook-loader'];
    return packageJson;
  });
  if (tree.exists('.storybook/story-loader.js')) {
    tree.rename('.storybook/story-loader.js', '.storybook/story-loader.ts');
  }
}
