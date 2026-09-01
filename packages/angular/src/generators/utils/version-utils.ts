import { getDependencyVersionFromPackageJson, type Tree } from '@nx/devkit';
import {
  getDeclaredPackageVersion,
  getInstalledPackageVersionFromTree,
} from '@nx/devkit/internal';
import { coerce, gte, major } from 'semver';
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
  return getDeclaredPackageVersion(tree, '@angular/core', angularVersion)!;
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

/**
 * Whether the installed `@angular/ssr` accepts an allowed hosts configuration.
 * The application engine and `CommonEngine` validate the request host against
 * it, and an unset allowlist matches nothing.
 */
export function supportsSsrAllowedHosts(tree: Tree): boolean {
  const version =
    getInstalledPackageVersionFromTree(tree, '@angular/ssr') ??
    getDeclaredPackageVersion(tree, '@angular/ssr');
  if (!version) {
    return false;
  }

  // Released in 20.3.17, 21.1.5 and 21.2.0, and never backported to 21.0
  const majorVersion = major(version);
  if (majorVersion === 20) {
    return gte(version, '20.3.17');
  }
  if (majorVersion === 21) {
    return gte(version, '21.1.5');
  }
  return majorVersion > 21;
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

// Helper types

type TakeUntil<Arr extends readonly any[], Target> = Arr extends readonly [
  infer Head,
  ...infer Rest,
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
