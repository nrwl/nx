import {
  addDependenciesToPackageJson,
  formatFiles,
  installPackagesTask,
  Tree,
} from '@nx/devkit';
import { swcCoreVersion, swcNodeVersion } from '@nx/js/src/utils/versions';

export default async function addSwcNodeIfNeeded(tree: Tree) {
  addDependenciesToPackageJson(
    tree,
    {},
    { '@swc-node/register': swcNodeVersion, '@swc/core': swcCoreVersion }
  );
  await formatFiles(tree);
  return installPackagesTask(tree);
}
