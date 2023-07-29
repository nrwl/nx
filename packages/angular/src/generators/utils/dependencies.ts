import { addDependenciesToPackageJson, Tree } from '@nx/devkit';
import { versions } from './version-utils';

export function addBuildableLibrariesPostCssDependencies(tree: Tree): void {
  const pkgVersions = versions(tree);
  addDependenciesToPackageJson(
    tree,
    {},
    {
      postcss: pkgVersions.postcssVersion,
      'postcss-import': pkgVersions.postcssImportVersion,
      'postcss-preset-env': pkgVersions.postcssPresetEnvVersion,
      'postcss-url': pkgVersions.postcssUrlVersion,
    }
  );
}
