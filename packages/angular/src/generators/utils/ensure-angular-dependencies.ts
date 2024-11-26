import {
  addDependenciesToPackageJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { getInstalledPackageVersion, versions } from './version-utils';

export function ensureAngularDependencies(tree: Tree): GeneratorCallback {
  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {};
  const pkgVersions = versions(tree);

  const installedAngularCoreVersion = getInstalledPackageVersion(
    tree,
    '@angular/core'
  );
  if (!installedAngularCoreVersion) {
    /**
     * If @angular/core is already installed, we assume the workspace was already
     * initialized with Angular dependencies and we don't want to re-install them.
     * This is to avoid re-installing Angular runtime dependencies that the user
     * might have removed.
     */
    const angularVersion = pkgVersions.angularVersion;
    const rxjsVersion =
      getInstalledPackageVersion(tree, 'rxjs') ?? pkgVersions.rxjsVersion;
    const tsLibVersion =
      getInstalledPackageVersion(tree, 'tslib') ?? pkgVersions.tsLibVersion;
    const zoneJsVersion =
      getInstalledPackageVersion(tree, 'zone.js') ?? pkgVersions.zoneJsVersion;

    dependencies['@angular/animations'] = angularVersion;
    dependencies['@angular/common'] = angularVersion;
    dependencies['@angular/compiler'] = angularVersion;
    dependencies['@angular/core'] = angularVersion;
    dependencies['@angular/forms'] = angularVersion;
    dependencies['@angular/platform-browser'] = angularVersion;
    dependencies['@angular/platform-browser-dynamic'] = angularVersion;
    dependencies['@angular/router'] = angularVersion;
    dependencies.rxjs = rxjsVersion;
    dependencies.tslib = tsLibVersion;
    dependencies['zone.js'] = zoneJsVersion;
  }

  const installedAngularDevkitVersion = getInstalledPackageVersion(
    tree,
    '@angular-devkit/build-angular'
  );
  if (!installedAngularDevkitVersion) {
    /**
     * If `@angular-devkit/build-angular` is already installed, we assume the workspace
     * was already initialized with Angular and we don't want to re-install the tooling.
     * This is to avoid re-installing Angular tooling that the user might have removed.
     */
    devDependencies['@angular/cli'] = pkgVersions.angularDevkitVersion;
    devDependencies['@angular/compiler-cli'] = pkgVersions.angularVersion;
    devDependencies['@angular/language-service'] = pkgVersions.angularVersion;
  }

  // Ensure the `@nx/angular` peer dependencies are always installed.
  const angularDevkitVersion =
    installedAngularDevkitVersion ?? pkgVersions.angularDevkitVersion;
  devDependencies['@angular-devkit/build-angular'] = angularDevkitVersion;
  devDependencies['@angular-devkit/schematics'] = angularDevkitVersion;
  devDependencies['@schematics/angular'] = angularDevkitVersion;

  return addDependenciesToPackageJson(
    tree,
    dependencies,
    devDependencies,
    undefined,
    true
  );
}
