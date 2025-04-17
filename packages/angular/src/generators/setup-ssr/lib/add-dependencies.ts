import { addDependenciesToPackageJson, type Tree } from '@nx/devkit';
import {
  getInstalledPackageVersionInfo,
  versions,
} from '../../utils/version-utils';

export function addDependencies(
  tree: Tree,
  isUsingApplicationBuilder: boolean
): void {
  const pkgVersions = versions(tree);

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
  if (!isUsingApplicationBuilder) {
    devDependencies['browser-sync'] = pkgVersions.browserSyncVersion;
  }

  addDependenciesToPackageJson(tree, dependencies, devDependencies);
}
