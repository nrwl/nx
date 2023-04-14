import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  Tree,
} from '@nx/devkit';
import { versions } from '../../utils/version-utils';

export function addTailwindRequiredPackages(tree: Tree): GeneratorCallback {
  const pkgVersions = versions(tree);
  return addDependenciesToPackageJson(
    tree,
    {},
    {
      autoprefixer: pkgVersions.autoprefixerVersion,
      postcss: pkgVersions.postcssVersion,
      tailwindcss: pkgVersions.tailwindVersion,
    }
  );
}
