import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  Tree,
} from '@nrwl/devkit';
import {
  autoprefixerVersion,
  postcssVersion,
  tailwindVersion,
} from '../../../utils/versions';

export function addTailwindRequiredPackages(tree: Tree): GeneratorCallback {
  return addDependenciesToPackageJson(
    tree,
    {},
    {
      autoprefixer: autoprefixerVersion,
      postcss: postcssVersion,
      tailwindcss: tailwindVersion,
    }
  );
}
