import { addDependenciesToPackageJson, Tree } from '@nx/devkit';
import {
  swcCliVersion,
  swcCoreVersion,
  swcHelpersVersion,
  swcNodeVersion,
} from '../versions';

export function getSwcDependencies(): {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
} {
  const dependencies = {
    '@swc/helpers': swcHelpersVersion,
  };
  const devDependencies = {
    '@swc/core': swcCoreVersion,
    '@swc/cli': swcCliVersion,
  };

  return { dependencies, devDependencies };
}

export function addSwcDependencies(tree: Tree) {
  const { dependencies, devDependencies } = getSwcDependencies();

  return addDependenciesToPackageJson(tree, dependencies, devDependencies);
}

export function addSwcRegisterDependencies(tree: Tree) {
  return addDependenciesToPackageJson(
    tree,
    {},
    { '@swc-node/register': swcNodeVersion, '@swc/core': swcCoreVersion }
  );
}
