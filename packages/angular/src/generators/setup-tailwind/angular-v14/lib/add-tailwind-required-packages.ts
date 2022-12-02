import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  Tree,
} from '@nrwl/devkit';
import { versions } from '../../../../utils/versions';

export function addTailwindRequiredPackages(tree: Tree): GeneratorCallback {
  return addDependenciesToPackageJson(
    tree,
    {},
    {
      autoprefixer: versions.angularV14.autoprefixerVersion,
      postcss: versions.angularV14.postcssVersion,
      tailwindcss: versions.angularV14.tailwindVersion,
    }
  );
}
