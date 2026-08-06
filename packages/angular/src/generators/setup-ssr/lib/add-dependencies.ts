import {
  addDependenciesToPackageJson,
  getDependencyVersionFromPackageJson,
  type Tree,
} from '@nx/devkit';
import { nxVersion } from '../../../utils/versions';
import {
  getInstalledAngularDevkitVersion,
  versions,
} from '../../utils/version-utils';

export function addDependencies(
  tree: Tree,
  isUsingApplicationBuilder: boolean,
  isUsingWebpackBuilder: boolean
): void {
  const pkgVersions = versions(tree);

  const dependencies: Record<string, string> = {
    '@angular/platform-server':
      getDependencyVersionFromPackageJson(tree, '@angular/platform-server') ??
      pkgVersions.angularVersion,
    express: pkgVersions.expressVersion,
  };
  const devDependencies: Record<string, string> = {
    '@types/express': pkgVersions.typesExpressVersion,
    '@types/node': pkgVersions.typesNodeVersion,
  };

  const angularDevkitVersion =
    getInstalledAngularDevkitVersion(tree) ?? pkgVersions.angularDevkitVersion;
  dependencies['@angular/ssr'] = angularDevkitVersion;

  if (!isUsingApplicationBuilder) {
    devDependencies['browser-sync'] = pkgVersions.browserSyncVersion;
    if (isUsingWebpackBuilder) {
      devDependencies['@nx/webpack'] = nxVersion;
      devDependencies['webpack-merge'] = pkgVersions.webpackMergeVersion;
    }
  } else {
    dependencies['@angular-devkit/build-angular'] = angularDevkitVersion;
  }

  addDependenciesToPackageJson(
    tree,
    dependencies,
    devDependencies,
    undefined,
    true
  );
}
