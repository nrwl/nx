import { getDependencyVersionFromPackageJson, type Tree } from '@nx/devkit';
import { getInstalledPackageVersion } from '@nx/devkit/internal';
import { join } from 'path';
import { clean, coerce, major } from 'semver';

const nxVersion = require(join('@nx/jest', 'package.json')).version;

export const minSupportedJestVersion = '29.0.0';
export const minSupportedTsJestVersion = '29.0.0';

// Jest is pinned to 30.3.x because jest-runtime@30.4.0 added a call to
// `_moduleMocker.clearMocksOnScope()`, which doesn't exist on the
// jest-mock@29 ModuleMocker that React Native's preset still feeds in
// (via `@react-native/jest-preset`'s pinned `jest-environment-node@^29.7.0`).
// Lift this once Meta ships a Jest-30-aware preset on react-native.
export const latestVersions = {
  nxVersion,
  jestVersion: '~30.3.0',
  babelJestVersion: '~30.3.0',
  jestTypesVersion: '~30.0.0',
  // ts-jest has not shipped a v30 — 29.x is its latest line and its peers
  // already span jest 29 and 30 (`jest: '^29.0.0 || ^30.0.0'`), so a jest-30
  // workspace correctly stays on ts-jest 29.x.
  tsJestVersion: '^29.4.0',
  tslibVersion: '^2.3.0',
  swcJestVersion: '~0.2.38',
  typesNodeVersion: '^22.0.0',
  tsNodeVersion: '10.9.1',
};

const supportedMajorVersions = [29, 30] as const;
type SupportedVersions = (typeof supportedMajorVersions)[number];
type PackageVersionNames = keyof typeof latestVersions;
export type VersionMap = {
  [key in SupportedVersions]: Record<PackageVersionNames, string>;
};

export const versionMap: VersionMap = {
  29: {
    nxVersion,
    jestVersion: '^29.7.0',
    babelJestVersion: '^29.7.0',
    jestTypesVersion: '^29.5.12',
    tsJestVersion: '^29.1.0',
    tslibVersion: '^2.3.0',
    swcJestVersion: '~0.2.36',
    typesNodeVersion: '18.16.9',
    tsNodeVersion: '10.9.1',
  },
  30: latestVersions,
};

export function versions(tree: Tree) {
  const installedJestVersion = getInstalledJestVersion(tree);
  if (!installedJestVersion) {
    return latestVersions;
  }

  const jestMajorVersion = major(installedJestVersion);
  return versionMap[jestMajorVersion as SupportedVersions] ?? latestVersions;
}

export function getInstalledJestVersion(tree?: Tree): string | null {
  if (!tree) {
    // Fall back to `@nx/jest`'s own jest when the workspace cwd can't resolve
    // one (e.g. inferred-plugin createNodes runs against an empty workspace).
    return getInstalledPackageVersion('jest') ?? getJestVersionFromRequire();
  }

  const installedVersion = getDependencyVersionFromPackageJson(tree, 'jest');
  if (!installedVersion) {
    return null;
  }
  if (installedVersion === 'latest' || installedVersion === 'next') {
    return (
      clean(latestVersions.jestVersion) ??
      coerce(latestVersions.jestVersion)?.version ??
      null
    );
  }
  return clean(installedVersion) ?? coerce(installedVersion)?.version ?? null;
}

function getJestVersionFromRequire(): string | null {
  try {
    return (<typeof import('jest')>require('jest')).getVersion();
  } catch {
    return null;
  }
}

export function getInstalledJestVersionInfo(tree?: Tree): {
  version: string | null;
  major: number | null;
} {
  const version = getInstalledJestVersion(tree);

  return version
    ? { version, major: major(version) }
    : { version: null, major: null };
}

export function getInstalledJestMajorVersion(tree?: Tree): number | null {
  const installedJestVersion = getInstalledJestVersion(tree);

  return installedJestVersion ? major(installedJestVersion) : null;
}
