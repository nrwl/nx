import {
  addDependenciesToPackageJson,
  formatFiles,
  type Tree,
} from '@nx/devkit';
import { getInstalledCypressMajorVersion } from '../../utils/versions';

export default async function (tree: Tree) {
  if (getInstalledCypressMajorVersion(tree) < 13) {
    return;
  }

  addDependenciesToPackageJson(tree, {}, { cypress: '^13.6.6' });

  await formatFiles(tree);
}
