import { readJson, Tree, updateJson } from '@nx/devkit';

/**
 * Remove eas-cli from dev dependencies.
 * Use globally eas-cli.
 * @param tree
 * @returns
 */
export default async function update(tree: Tree) {
  const packageJson = readJson(tree, 'package.json');

  if (!packageJson.devDependencies['eas-cli']) {
    return;
  }

  updateJson(tree, 'package.json', (packageJson) => {
    delete packageJson.devDependencies['eas-cli'];
    return packageJson;
  });
}
