import { readJson, type Tree } from '@nx/devkit';
import { clean, coerce, major } from 'semver';
import {
  backwardCompatibleVersions,
  type PackageCompatVersions,
  type PackageLatestVersions,
} from '../../utils/backward-compatible-versions';
import * as latestVersions from '../../utils/versions';
import { angularVersion } from '../../utils/versions';

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

export function versions(
  tree: Tree
): PackageLatestVersions | PackageCompatVersions {
  const majorAngularVersion = getInstalledAngularMajorVersion(tree);
  switch (majorAngularVersion) {
    case 16:
      return backwardCompatibleVersions.angularV16;
    case 17:
      return backwardCompatibleVersions.angularV17;
    default:
      return latestVersions;
  }
}
