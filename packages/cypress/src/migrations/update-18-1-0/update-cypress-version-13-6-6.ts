import {
  addDependenciesToPackageJson,
  formatFiles,
  type Tree,
} from '@nx/devkit';
import { installedCypressVersion } from '../../utils/cypress-version';

export default async function (tree: Tree) {
  if (installedCypressVersion() < 13) {
    return;
  }

  addDependenciesToPackageJson(tree, {}, { cypress: '^13.6.6' });

  await formatFiles(tree);
}
