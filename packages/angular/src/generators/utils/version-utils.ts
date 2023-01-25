import type { Tree } from '@nrwl/devkit';
import { readJson } from '@nrwl/devkit';
import { clean, coerce, major } from 'semver';
import { angularVersion } from '../../utils/versions';

export function getGeneratorDirectoryForInstalledAngularVersion(
  tree: Tree
): string | null {
  const majorAngularVersion = getInstalledAngularMajorVersion(tree);

  const directoryDictionary = {
    14: 'angular-v14',
  };

  return directoryDictionary[majorAngularVersion] ?? null;
}

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

export function getInstalledPackageVersionInfo(tree: Tree, pkgName: string) {
  try {
    const version =
      readJson(tree, 'package.json').dependencies?.[pkgName] ??
      readJson(tree, 'package.json').devDependencies?.[pkgName];

    return { major: major(coerce(version)), version };
  } catch {
    return null;
  }
}
