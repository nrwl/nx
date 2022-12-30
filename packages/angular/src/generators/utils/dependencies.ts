import { addDependenciesToPackageJson, Tree } from '@nrwl/devkit';
import {
  postcssImportVersion,
  postcssPresetEnvVersion,
  postcssUrlVersion,
  postcssVersion,
} from '../../utils/versions';

export function addBuildableLibrariesPostCssDependencies(tree: Tree): void {
  addDependenciesToPackageJson(
    tree,
    {},
    {
      postcss: postcssVersion,
      'postcss-import': postcssImportVersion,
      'postcss-preset-env': postcssPresetEnvVersion,
      'postcss-url': postcssUrlVersion,
    }
  );
}
