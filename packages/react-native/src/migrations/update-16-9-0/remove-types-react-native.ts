import { readJson, Tree, updateJson } from '@nx/devkit';

/**
 * Remove @types/react-native package since it is no longer required. It would be a part of react native package.
 * @param tree
 * @returns
 */
export default async function update(tree: Tree) {
  const packageJson = readJson(tree, 'package.json');

  if (
    !packageJson.devDependencies['@types/react-native'] ||
    !packageJson.dependencies['react-native']
  ) {
    return;
  }

  updateJson(tree, 'package.json', (packageJson) => {
    delete packageJson.devDependencies['@types/react-native'];
    return packageJson;
  });
}
