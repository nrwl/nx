import {
  addDependenciesToPackageJson,
  getDependencyVersionFromPackageJson,
  readJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import type { PackageJson } from 'nx/src/utils/package-json';
import {
  getInstalledAngularDevkitVersion,
  getInstalledAngularVersionInfo,
  versions,
} from './version-utils';

export function ensureAngularDependencies(tree: Tree): GeneratorCallback {
  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {};
  const pkgVersions = versions(tree);

  const packageJson = readJson<PackageJson>(tree, 'package.json');
  const installedAngularCoreVersion = getDependencyVersionFromPackageJson(
    tree,
    '@angular/core',
    packageJson
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
      getDependencyVersionFromPackageJson(tree, 'rxjs', packageJson) ??
      pkgVersions.rxjsVersion;
    const tsLibVersion =
      getDependencyVersionFromPackageJson(tree, 'tslib', packageJson) ??
      pkgVersions.tsLibVersion;
    const zoneJsVersion =
      getDependencyVersionFromPackageJson(tree, 'zone.js', packageJson) ??
      pkgVersions.zoneJsVersion;

    dependencies['@angular/common'] = angularVersion;
    dependencies['@angular/compiler'] = angularVersion;
    dependencies['@angular/core'] = angularVersion;
    dependencies['@angular/forms'] = angularVersion;
    dependencies['@angular/platform-browser'] = angularVersion;
    dependencies['@angular/router'] = angularVersion;
    dependencies.rxjs = rxjsVersion;
    dependencies.tslib = tsLibVersion;
    dependencies['zone.js'] = zoneJsVersion;
  }

  const installedAngularDevkitVersion = getInstalledAngularDevkitVersion(tree);
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
  devDependencies['@angular-devkit/schematics'] = angularDevkitVersion;
  devDependencies['@schematics/angular'] = angularDevkitVersion;

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  if (angularMajorVersion < 20) {
    devDependencies['@angular/build'] = angularDevkitVersion;
    devDependencies['@angular-devkit/build-angular'] = angularDevkitVersion;
  }

  return addDependenciesToPackageJson(
    tree,
    dependencies,
    devDependencies,
    undefined,
    true
  );
}
