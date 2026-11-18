import { getDependencyVersionFromPackageJson, type Tree } from '@nx/devkit';
import {
  getDeclaredPackageVersion,
  getInstalledPackageVersionFromTree,
} from '@nx/devkit/internal';
import { coerce, major, satisfies, subset, validRange } from 'semver';
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

// Released in 20.3.17, 21.1.5 and 21.2.0, and never backported to 21.0.
// Prereleases are deliberately not matched: the option landed part-way through
// the 21.2 prerelease train, so a prerelease says nothing about whether it is
// there.
const SSR_ALLOWED_HOSTS_RANGE = '>=20.3.17 <21.0.0 || >=21.1.5';
const SSR_ALLOWED_HOSTS_FLOORS = ['20.3.17', '21.1.5', '21.2.0'];
// A single caret, tilde or exact version. Raising anything else, a union of
// ranges above all, would drop the release lines it covers.
const RAISABLE_RANGE = /^[~^]?\d+\.\d+\.\d+(?:-[\w.]+)?$/;

/**
 * Whether every `@angular/ssr` version a range allows accepts an allowed hosts
 * configuration. A range is not always resolved to its highest version, the
 * `resolution-mode` setting in pnpm being one way to ask for the lowest, so a
 * range that merely reaches such a version is not enough.
 */
function rangeAcceptsSsrAllowedHosts(range: string): boolean {
  return !!validRange(range) && subset(range, SSR_ALLOWED_HOSTS_RANGE);
}

/**
 * Whether every `@angular/ssr` version the workspace can end up with accepts
 * an allowed hosts configuration. The application engine and `CommonEngine`
 * validate the request host against it, and an unset allowlist matches nothing.
 */
export function supportsSsrAllowedHosts(tree: Tree): boolean {
  const installed = getInstalledPackageVersionFromTree(tree, '@angular/ssr');
  if (installed) {
    return satisfies(installed, SSR_ALLOWED_HOSTS_RANGE);
  }

  const declared = getDependencyVersionFromPackageJson(tree, '@angular/ssr');
  return !!declared && rangeAcceptsSsrAllowedHosts(declared);
}

/**
 * Raises the floor of an `@angular/ssr` version range to the first version in
 * it that accepts an allowed hosts configuration, so the scaffolded setup can
 * use the option no matter how the range is resolved. The range is returned
 * unchanged when every version it allows already accepts one, when no version
 * in it does, and when raising it would change the release lines it covers.
 */
export function withSsrAllowedHostsSupport(range: string): string {
  if (rangeAcceptsSsrAllowedHosts(range) || !RAISABLE_RANGE.test(range)) {
    return range;
  }

  const floor = SSR_ALLOWED_HOSTS_FLOORS.find((version) =>
    satisfies(version, range)
  );
  if (!floor) {
    return range;
  }

  const operator =
    range.startsWith('~') || range.startsWith('^') ? range[0] : '';
  const raised = `${operator}${floor}`;
  return rangeAcceptsSsrAllowedHosts(raised) ? raised : range;
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
