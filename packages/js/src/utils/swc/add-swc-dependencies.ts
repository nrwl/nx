import {
  addDependenciesToPackageJson,
  detectPackageManager,
  Tree,
} from '@nx/devkit';
import { acknowledgeBuildScripts } from '@nx/devkit/internal';
import {
  swcCliVersion,
  swcCoreVersion,
  swcHelpersVersion,
  swcNodeVersion,
} from '../versions';

// @swc/core's postinstall only compiles a fallback for platforms without
// prebuilt binaries, so skip it.
const swcAllowBuilds = { '@swc/core': false };

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

  acknowledgeBuildScripts(
    tree,
    detectPackageManager(tree.root),
    swcAllowBuilds
  );
  return addDependenciesToPackageJson(
    tree,
    dependencies,
    devDependencies,
    undefined,
    true
  );
}

export function addSwcRegisterDependencies(tree: Tree) {
  acknowledgeBuildScripts(
    tree,
    detectPackageManager(tree.root),
    swcAllowBuilds
  );
  return addDependenciesToPackageJson(
    tree,
    {},
    { '@swc-node/register': swcNodeVersion, '@swc/core': swcCoreVersion },
    undefined,
    true
  );
}
