import {
  Tree,
  formatFiles,
  removeDependenciesFromPackageJson,
} from '@nx/devkit';

export default async function removePackages(tree: Tree): Promise<void> {
  removeDependenciesFromPackageJson(
    tree,
    ['core-js', 'regenerator-runtime'],
    []
  );

  await formatFiles(tree);
}
