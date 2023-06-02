import {
  Tree,
  formatFiles,
  removeDependenciesFromPackageJson,
} from '@nx/devkit';

export default async function removePackage(tree: Tree): Promise<void> {
  removeDependenciesFromPackageJson(tree, [], ['react-test-renderer']);
  await formatFiles(tree);
}
