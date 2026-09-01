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
import type { NormalizedGeneratorOptions } from '../schema';

export function addDependencies(
  tree: Tree,
  options: NormalizedGeneratorOptions
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

  if (options.isUsingApplicationBuilder) {
    dependencies['@angular-devkit/build-angular'] = angularDevkitVersion;
  } else if (!options.isRspack) {
    // The rspack conversion removes the targets that use these packages
    devDependencies['browser-sync'] = pkgVersions.browserSyncVersion;
    if (options.isUsingWebpackBuilder) {
      devDependencies['@nx/webpack'] = nxVersion;
      devDependencies['webpack-merge'] = pkgVersions.webpackMergeVersion;
    }
  }

  addDependenciesToPackageJson(
    tree,
    dependencies,
    devDependencies,
    undefined,
    true
  );
}
