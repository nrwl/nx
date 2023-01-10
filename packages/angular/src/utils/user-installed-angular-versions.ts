import type { Tree } from '@nrwl/devkit';
import { readJson } from '@nrwl/devkit';
import { clean, coerce, major } from 'semver';
import { angularVersion } from './versions';

export function getGeneratorDirectoryForInstalledAngularVersion(tree: Tree) {
  const majorAngularVersion = getUserInstalledAngularMajorVersion(tree);

  const directoryDictionary = {
    14: 'angular-v14',
  };

  return directoryDictionary[majorAngularVersion] ?? null;
}

export function getUserInstalledAngularVersion(tree: Tree) {
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

export function getUserInstalledAngularMajorVersion(tree: Tree): number {
  return major(getUserInstalledAngularVersion(tree));
}

export function getUserInstalledAngularVersionInfo(tree: Tree) {
  const installedVersion = getUserInstalledAngularVersion(tree);
  return {
    cleanedVersion: installedVersion,
    major: major(installedVersion),
  };
}
