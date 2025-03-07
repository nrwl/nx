import { type Tree, addDependenciesToPackageJson } from '@nx/devkit';
import { jitiVersion } from '../../utils/versions';

export default async function installJiti(tree: Tree) {
  const installTask = addDependenciesToPackageJson(
    tree,
    {},
    {
      jiti: jitiVersion,
    }
  );

  return installTask;
}
