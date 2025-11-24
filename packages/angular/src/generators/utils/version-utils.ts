import { getDependencyVersionFromPackageJson, type Tree } from '@nx/devkit';
import { clean, coerce, major } from 'semver';
import {
  backwardCompatibleVersions,
  type PackageCompatVersions,
  type SupportedVersion,
  supportedVersions,
  type VersionMap,
} from '../../utils/backward-compatible-versions';
import * as latestVersions from '../../utils/versions';
import { angularVersion } from '../../utils/versions';

export function getInstalledAngularDevkitVersion(tree: Tree): string | null {
  return (
    getDependencyVersionFromPackageJson(
      tree,
      '@angular-devkit/build-angular'
    ) ?? getDependencyVersionFromPackageJson(tree, '@angular/build')
  );
}

export function getInstalledAngularVersion(tree: Tree): string {
  const installedAngularVersion = getDependencyVersionFromPackageJson(
    tree,
    '@angular/core'
  );

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
  const version = getDependencyVersionFromPackageJson(tree, pkgName);

  return version ? { major: major(coerce(version)), version } : null;
}

export function versions(tree: Tree): PackageCompatVersions;
export function versions<V extends SupportedVersion>(
  tree: Tree,
  options: { minAngularMajorVersion: V }
): MinVersionReturnType<V>;
export function versions(
  tree: Tree,
  options?: { minAngularMajorVersion: SupportedVersion }
): PackageCompatVersions {
  const majorAngularVersion = getInstalledAngularMajorVersion(tree);

  if (
    options?.minAngularMajorVersion &&
    majorAngularVersion < options.minAngularMajorVersion
  ) {
    throw new Error(
      `This operation requires Angular ${options.minAngularMajorVersion}+, but found version ${majorAngularVersion}. ` +
        `This shouldn't happen. Please report it as a bug and include the stack trace.`
    );
  }

  return backwardCompatibleVersions[majorAngularVersion] ?? latestVersions;
}

/**
 * Temporary helper to abstract away the version of angular-rspack to be installed
 * until we stop supporting Angular 19.
 */
export function getAngularRspackVersion(tree: Tree): string {
  const majorAngularVersion = getInstalledAngularMajorVersion(tree);

  // Starting with Angular 20, we can use an Angular Rspack version that is
  // aligned with the Nx version
  return majorAngularVersion === 19
    ? backwardCompatibleVersions[19].angularRspackVersion
    : latestVersions.nxVersion;
}

// Helper types

type TakeUntil<Arr extends readonly any[], Target> = Arr extends readonly [
  infer Head,
  ...infer Rest
]
  ? Head extends Target
    ? [Head]
    : [Head, ...TakeUntil<Rest, Target>]
  : [];
type VersionsAtLeast<MinV extends SupportedVersion> = Extract<
  SupportedVersion,
  TakeUntil<typeof supportedVersions, MinV>[number]
>;
type MinVersionReturnType<MinV extends SupportedVersion> =
  VersionMap[VersionsAtLeast<MinV>];
