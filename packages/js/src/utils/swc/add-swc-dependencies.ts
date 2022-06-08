import { addDependenciesToPackageJson, Tree } from '@nrwl/devkit';
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
