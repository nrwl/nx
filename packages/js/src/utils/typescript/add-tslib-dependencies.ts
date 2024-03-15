import {
  addDependenciesToPackageJson,
  joinPathFragments,
  Tree,
} from '@nx/devkit';
import { tsLibVersion } from '../versions';

export function addTsLibDependencies(tree: Tree, root: string = '') {
  return addDependenciesToPackageJson(
    tree,
    {
      tslib: tsLibVersion,
    },
    {},
    joinPathFragments(root, 'package.json')
  );
}
