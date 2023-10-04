import { addDependenciesToPackageJson, Tree } from '@nx/devkit';
import {
  swcCliVersion,
  swcCoreVersion,
  swcHelpersVersion,
  swcNodeVersion,
} from '../versions';

export function addSwcDependencies(tree: Tree) {
  return addDependenciesToPackageJson(
    tree,
    {
      '@swc/helpers': swcHelpersVersion,
    },
    {
      '@swc/core': swcCoreVersion,
      '@swc/cli': swcCliVersion,
    }
  );
}

export function addSwcRegisterDependencies(tree: Tree) {
  return addDependenciesToPackageJson(
    tree,
    {},
    { '@swc-node/register': swcNodeVersion, '@swc/core': swcCoreVersion }
  );
}
