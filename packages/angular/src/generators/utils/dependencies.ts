import { addDependenciesToPackageJson, Tree } from '@nx/devkit';
import { versions } from './version-utils';

export function addBuildableLibrariesPostCssDependencies(tree: Tree): void {
  const pkgVersions = versions(tree);
  addDependenciesToPackageJson(
    tree,
    {},
    {
      postcss: pkgVersions.postcssVersion,
      autoprefixer: pkgVersions.autoprefixerVersion,
      'postcss-url': pkgVersions.postcssUrlVersion,
    }
  );
}
