import {
  addDependenciesToPackageJson,
  formatFiles,
  installPackagesTask,
  Tree,
} from '@nrwl/devkit';
import { swcCoreVersion, swcNodeVersion } from 'nx/src/utils/versions';

export default async function addSwcNodeIfNeeded(tree: Tree) {
  addDependenciesToPackageJson(
    tree,
    {},
    { '@swc-node/register': swcNodeVersion, '@swc/core': swcCoreVersion }
  );
  await formatFiles(tree);
  return installPackagesTask(tree);
}
