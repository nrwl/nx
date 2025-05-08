import { addDependenciesToPackageJson, type Tree } from '@nx/devkit';
import {
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
    getInstalledPackageVersion(tree, '@angular-devkit/build-angular') ??
    getInstalledPackageVersion(tree, '@angular/build') ??
    pkgVersions.angularDevkitVersion;
  if (!isUsingApplicationBuilder) {
    devDependencies['browser-sync'] = pkgVersions.browserSyncVersion;
  }

  addDependenciesToPackageJson(tree, dependencies, devDependencies);
}
