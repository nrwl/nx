import { addDependenciesToPackageJson, type Tree } from '@nx/devkit';
import { gte } from 'semver';
import type { VersionMap } from '../../../utils/backward-compatible-versions';
import {
  getInstalledAngularVersionInfo,
  getInstalledPackageVersionInfo,
  versions,
} from '../../utils/version-utils';

export function addDependencies(
  tree: Tree,
  isUsingApplicationBuilder: boolean
): void {
  const pkgVersions = versions(tree);
  const { major: angularMajorVersion, version: angularVersion } =
    getInstalledAngularVersionInfo(tree);

  const dependencies: Record<string, string> = {
    '@angular/platform-server':
      getInstalledPackageVersionInfo(tree, '@angular/platform-server')
        ?.version ?? pkgVersions.angularVersion,
    express: pkgVersions.expressVersion,
  };
  const devDependencies: Record<string, string> = {
    '@types/express': pkgVersions.typesExpressVersion,
  };

  if (angularMajorVersion >= 17) {
    dependencies['@angular/ssr'] =
      getInstalledPackageVersionInfo(tree, '@angular-devkit/build-angular')
        ?.version ?? pkgVersions.angularDevkitVersion;
    if (!isUsingApplicationBuilder && gte(angularVersion, '17.1.0')) {
      devDependencies['browser-sync'] = pkgVersions.browserSyncVersion;
    }
  } else {
    dependencies['@nguniversal/express-engine'] =
      getInstalledPackageVersionInfo(tree, '@nguniversal/express-engine')
        ?.version ??
      (pkgVersions as VersionMap['angularV16']).ngUniversalVersion;
    devDependencies['@nguniversal/builders'] =
      getInstalledPackageVersionInfo(tree, '@nguniversal/builders')?.version ??
      (pkgVersions as VersionMap['angularV16']).ngUniversalVersion;
  }

  addDependenciesToPackageJson(tree, dependencies, devDependencies);
}
