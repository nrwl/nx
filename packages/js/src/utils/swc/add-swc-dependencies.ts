import { addDependenciesToPackageJson, Tree } from '@nx/devkit';
import { swcCliVersion, swcCoreVersion, swcHelpersVersion } from '../versions';

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
