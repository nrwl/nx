import { readJson, type Tree } from '@nx/devkit';
import { clean, coerce, major } from 'semver';

const nxVersion = require('../../package.json').version;

export const latestVersions = {
  nxVersion,
  jestVersion: '^30.0.2',
  babelJestVersion: '^30.0.2',
  jestTypesVersion: '^30.0.0',
  tsJestVersion: '^29.4.0',
  tslibVersion: '^2.3.0',
  swcJestVersion: '~0.2.38',
  typesNodeVersion: '20.19.9',
  tsNodeVersion: '10.9.1',
};

const supportedMajorVersions = [29, 30] as const;
const minSupportedMajorVersion = Math.min(...supportedMajorVersions);
const currentMajorVersion = Math.max(...supportedMajorVersions);

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
  if (versionMap[jestMajorVersion]) {
    return versionMap[jestMajorVersion];
  }

  const backwardCompatibleVersions = supportedMajorVersions.slice(0, -1);
  throw new Error(
    `You're currently using an unsupported Jest version: ${installedJestVersion}. Supported major versions are ${backwardCompatibleVersions.join(
      ', '
    )} and ${currentMajorVersion}.`
  );
}

export function getInstalledJestVersion(tree?: Tree): string | null {
  try {
    let version: string | null;

    if (tree) {
      version = getJestVersionFromTree(tree);
    } else {
      version = getJestVersionFromFileSystem();
    }

    return version;
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

export function validateInstalledJestVersion(tree?: Tree): void {
  const { version, major } = getInstalledJestVersionInfo(tree);
  if (!version) {
    return;
  }

  if (major < minSupportedMajorVersion || major > currentMajorVersion) {
    const backwardCompatibleVersions = supportedMajorVersions.slice(0, -1);
    throw new Error(
      `You're currently using an unsupported Jest version: ${version}. Supported major versions are ${backwardCompatibleVersions.join(
        ', '
      )} and ${currentMajorVersion}.`
    );
  }
}

function getJestVersionFromTree(tree: Tree): string | null {
  const packageJson = readJson(tree, 'package.json');
  const installedVersion =
    packageJson.devDependencies?.jest ?? packageJson.dependencies?.jest;

  if (!installedVersion) {
    return null;
  }

  if (installedVersion === 'latest' || installedVersion === 'next') {
    return (
      clean(latestVersions.jestVersion) ??
      coerce(latestVersions.jestVersion)?.version
    );
  }

  return clean(installedVersion) ?? coerce(installedVersion)?.version;
}

function getJestVersionFromFileSystem(): string | null {
  try {
    const { getVersion } = <typeof import('jest')>require('jest');

    return getVersion();
  } catch {}

  return null;
}
