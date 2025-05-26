import { addDependenciesToPackageJson, type Tree } from '@nx/devkit';
import {
  getInstalledAngularDevkitVersion,
  getInstalledAngularVersionInfo,
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

  const angularDevkitVersion =
    getInstalledAngularDevkitVersion(tree) ?? pkgVersions.angularDevkitVersion;
  dependencies['@angular/ssr'] = angularDevkitVersion;

  if (!isUsingApplicationBuilder) {
    devDependencies['browser-sync'] = pkgVersions.browserSyncVersion;
  } else {
    const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
    if (angularMajorVersion >= 20) {
      dependencies['@angular-devkit/build-angular'] = angularDevkitVersion;
    }
  }

  addDependenciesToPackageJson(tree, dependencies, devDependencies);
}
