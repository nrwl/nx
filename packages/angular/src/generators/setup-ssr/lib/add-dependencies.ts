import { addDependenciesToPackageJson, type Tree } from '@nx/devkit';
import {
  getInstalledAngularDevkitVersion,
  getInstalledPackageVersion,
  versions,
} from '../../utils/version-utils';

export function addDependencies(
  tree: Tree,
  isUsingApplicationBuilder: boolean
): void {
  const pkgVersions = versions(tree);

  const dependencies: Record<string, string> = {
    '@angular/platform-server':
      getInstalledPackageVersion(tree, '@angular/platform-server') ??
      pkgVersions.angularVersion,
    express: pkgVersions.expressVersion,
  };
  const devDependencies: Record<string, string> = {
    '@types/express': pkgVersions.typesExpressVersion,
  };

  dependencies['@angular/ssr'] =
    getInstalledAngularDevkitVersion(tree) ?? pkgVersions.angularDevkitVersion;
  if (!isUsingApplicationBuilder) {
    devDependencies['browser-sync'] = pkgVersions.browserSyncVersion;
  }

  addDependenciesToPackageJson(tree, dependencies, devDependencies);
}
