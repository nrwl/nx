import type { GeneratorCallback, Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJsonIfDontExist,
  getInstalledPackageVersion,
  versions,
} from './version-utils';

export function ensureAngularDependencies(tree: Tree): GeneratorCallback {
  const pkgVersions = versions(tree);

  const angularVersion =
    getInstalledPackageVersion(tree, '@angular/core') ??
    pkgVersions.angularVersion;
  const angularDevkitVersion =
    getInstalledPackageVersion(tree, '@angular-devkit/build-angular') ??
    pkgVersions.angularDevkitVersion;
  const rxjsVersion =
    getInstalledPackageVersion(tree, 'rxjs') ?? pkgVersions.rxjsVersion;
  const tsLibVersion =
    getInstalledPackageVersion(tree, 'tslib') ?? pkgVersions.tsLibVersion;
  const zoneJsVersion =
    getInstalledPackageVersion(tree, 'zone.js') ?? pkgVersions.zoneJsVersion;

  return addDependenciesToPackageJsonIfDontExist(
    tree,
    {
      '@angular/animations': angularVersion,
      '@angular/common': angularVersion,
      '@angular/compiler': angularVersion,
      '@angular/core': angularVersion,
      '@angular/forms': angularVersion,
      '@angular/platform-browser': angularVersion,
      '@angular/platform-browser-dynamic': angularVersion,
      '@angular/router': angularVersion,
      rxjs: rxjsVersion,
      tslib: tsLibVersion,
      'zone.js': zoneJsVersion,
    },
    {
      '@angular/cli': angularDevkitVersion,
      '@angular/compiler-cli': angularVersion,
      '@angular/language-service': angularVersion,
      '@angular-devkit/build-angular': angularDevkitVersion,
      '@angular-devkit/schematics': angularDevkitVersion,
      '@schematics/angular': angularDevkitVersion,
    }
  );
}
