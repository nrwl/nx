import type { GeneratorCallback, Tree } from '@nx/devkit';
import { addDependenciesToPackageJson, readJson } from '@nx/devkit';
import { clean, coerce, major } from 'semver';
import * as latestVersions from '../../utils/versions';
import { angularVersion } from '../../utils/versions';
import { backwardCompatibleVersions } from '../../utils/backward-compatible-versions';

export function getInstalledAngularVersion(tree: Tree): string {
  const pkgJson = readJson(tree, 'package.json');
  const installedAngularVersion =
    pkgJson.dependencies && pkgJson.dependencies['@angular/core'];

  if (
    !installedAngularVersion ||
    installedAngularVersion === 'latest' ||
    installedAngularVersion === 'next'
  ) {
    return clean(angularVersion) ?? coerce(angularVersion).version;
  }

  return (
    clean(installedAngularVersion) ?? coerce(installedAngularVersion).version
  );
}

export function getInstalledAngularMajorVersion(tree: Tree): number {
  return major(getInstalledAngularVersion(tree));
}

export function getInstalledAngularVersionInfo(tree: Tree) {
  const installedVersion = getInstalledAngularVersion(tree);

  return {
    version: installedVersion,
    major: major(installedVersion),
  };
}

export function getInstalledPackageVersion(
  tree: Tree,
  pkgName: string
): string | null {
  const { dependencies, devDependencies } = readJson(tree, 'package.json');
  const version = dependencies?.[pkgName] ?? devDependencies?.[pkgName];

  return version;
}

export function getInstalledPackageVersionInfo(tree: Tree, pkgName: string) {
  const version = getInstalledPackageVersion(tree, pkgName);

  return version ? { major: major(coerce(version)), version } : null;
}

export function addDependenciesToPackageJsonIfDontExist(
  tree: Tree,
  dependencies: Record<string, string>,
  devDependencies: Record<string, string>,
  packageJsonPath: string = 'package.json'
): GeneratorCallback {
  const packageJson = readJson(tree, packageJsonPath);

  function filterExisting(
    deps: Record<string, string>
  ): Record<string, string> {
    return Object.keys(deps)
      .filter(
        (d) =>
          !packageJson.dependencies?.[d] && !packageJson.devDependencies?.[d]
      )
      .reduce((acc, d) => ({ ...acc, [d]: deps[d] }), {});
  }

  const depsToAdd = filterExisting(dependencies);
  const devDepsToAdd = filterExisting(devDependencies);

  return addDependenciesToPackageJson(
    tree,
    depsToAdd,
    devDepsToAdd,
    packageJsonPath
  );
}

export function versions(tree: Tree) {
  const majorAngularVersion = getInstalledAngularMajorVersion(tree);
  switch (majorAngularVersion) {
    case 14:
      return backwardCompatibleVersions.angularV14;
    case 15:
      return backwardCompatibleVersions.angularV15;
    default:
      return latestVersions;
  }
}
