import { addDependenciesToPackageJson, type Tree } from '@nx/devkit';
import { gte } from 'semver';
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
  const { version: angularVersion } = getInstalledAngularVersionInfo(tree);

  const dependencies: Record<string, string> = {
    '@angular/platform-server':
      getInstalledPackageVersionInfo(tree, '@angular/platform-server')
        ?.version ?? pkgVersions.angularVersion,
    express: pkgVersions.expressVersion,
  };
  const devDependencies: Record<string, string> = {
    '@types/express': pkgVersions.typesExpressVersion,
  };

  dependencies['@angular/ssr'] =
    getInstalledPackageVersionInfo(tree, '@angular-devkit/build-angular')
      ?.version ?? pkgVersions.angularDevkitVersion;
  if (!isUsingApplicationBuilder && gte(angularVersion, '17.1.0')) {
    devDependencies['browser-sync'] = pkgVersions.browserSyncVersion;
  }

  addDependenciesToPackageJson(tree, dependencies, devDependencies);
}
