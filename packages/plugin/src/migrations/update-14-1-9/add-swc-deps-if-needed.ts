import { formatFiles, installPackagesTask, Tree } from '@nx/devkit';
import { addSwcRegisterDependencies } from '@nx/js/src/utils/swc/add-swc-dependencies';

export default async function addSwcNodeIfNeeded(tree: Tree) {
  addSwcRegisterDependencies(tree);
  await formatFiles(tree);
  return installPackagesTask(tree);
}
