import { addDependenciesToPackageJson, Tree } from '@nrwl/devkit';
import { postcssVersion } from '../../utils/versions';

export function addBuildableLibrariesPostCssDependencies(tree: Tree): void {
  addDependenciesToPackageJson(
    tree,
    {},
    {
      postcss: postcssVersion,
      'postcss-import': '~14.1.0',
      'postcss-preset-env': '~7.5.0',
      'postcss-url': '~10.1.3',
    }
  );
}
