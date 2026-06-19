import {
  addDependenciesToPackageJson,
  getDependencyVersionFromPackageJson,
  type Tree,
} from '@nx/devkit';
import {
  getInstalledAngularDevkitVersion,
  versions,
} from '../../utils/version-utils';

export function addDependencies(
  tree: Tree,
  isUsingApplicationBuilder: boolean
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
