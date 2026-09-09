import { getDependencyVersionFromPackageJson, type Tree } from '@nx/devkit';
import {
  getInstalledPackageVersion,
  getResolvedPackageVersion,
  getSatisfyingInstalledPackageVersion,
} from '@nx/devkit/internal';
import { join } from 'path';
import { coerce, intersects, major, validRange } from 'semver';

export const nxVersion = require(join('@nx/cypress', 'package.json')).version;
export const minSupportedCypressVersion = '13.0.0';
export const eslintPluginCypressVersion = '^3.5.0';
export const typesNodeVersion = '^22.0.0';
export const cypressViteDevServerVersion = '^8.0.0';
export const cypressVersion = '^16.0.0';
export const cypressWebpackVersion = '^6.0.0';
export const viteVersion = '^8.0.0';
export const htmlWebpackPluginVersion = '^5.5.0';

export type CypressVersions = Record<
  keyof Omit<
    typeof import('./versions'),
    | 'nxVersion'
    | 'minSupportedCypressVersion'
    | 'versions'
    | 'getInstalledCypressVersion'
    | 'getInstalledCypressMajorVersion'
    | 'assertMinimumCypressVersion'
  >,
  string
>;

const latestVersions: CypressVersions = {
  eslintPluginCypressVersion,
  typesNodeVersion,
  cypressViteDevServerVersion,
  cypressVersion,
  cypressWebpackVersion,
  viteVersion,
  htmlWebpackPluginVersion,
};

type CompatVersions = 13 | 14 | 15;
const versionMap: Record<CompatVersions, CypressVersions> = {
  13: {
    eslintPluginCypressVersion: '^3.5.0',
    typesNodeVersion: '^22.0.0',
    cypressViteDevServerVersion: '^2.2.1',
    cypressVersion: '^13.13.0',
    cypressWebpackVersion: '^3.8.0',
    viteVersion: '~5.0.0',
    htmlWebpackPluginVersion: '^5.5.0',
  },
  14: {
    eslintPluginCypressVersion: '^3.5.0',
    typesNodeVersion: '^22.0.0',
    cypressViteDevServerVersion: '^6.0.3',
    cypressVersion: '^14.2.1',
    cypressWebpackVersion: '^4.0.2',
    viteVersion: '^6.0.0',
    htmlWebpackPluginVersion: '^5.5.0',
  },
  15: {
    eslintPluginCypressVersion: '^3.5.0',
    typesNodeVersion: '^22.0.0',
    cypressViteDevServerVersion: '^7.3.1',
    cypressVersion: '^15.20.1',
    cypressWebpackVersion: '^5.4.1',
    viteVersion: '^6.0.0',
    htmlWebpackPluginVersion: '^5.5.0',
  },
};

// Highest first, so a range reaching several majors resolves to the top one.
const supportedMajors = [
  major(coerce(cypressVersion)),
  ...Object.keys(versionMap).map(Number),
].sort((a, b) => b - a);

export function versions(tree: Tree): CypressVersions {
  const installedCypressVersion = getInstalledCypressVersion(tree);
  if (!installedCypressVersion) {
    return latestVersions;
  }

  const cypressMajorVersion = major(installedCypressVersion);
  return versionMap[cypressMajorVersion as CompatVersions] ?? latestVersions;
}

export function getInstalledCypressVersion(tree?: Tree): string | null {
  if (!tree) {
    return getInstalledPackageVersion('cypress');
  }

  const resolved = getResolvedPackageVersion(tree, 'cypress');
  const declared = getDependencyVersionFromPackageJson(tree, 'cypress');
  if (
    !resolved ||
    !declared ||
    !validRange(declared) ||
    getSatisfyingInstalledPackageVersion(tree, 'cypress', declared)
  ) {
    return resolved;
  }

  // Nothing installed, so `resolved` is the range floor. A clean install
  // resolves the highest version the range admits, so follow the highest
  // supported major it reaches; the version inside that major is unknown.
  const floorMajor = major(resolved);
  const reachedMajor = supportedMajors.find(
    (m) => m > floorMajor && intersects(declared, `${m}.x`)
  );
  return reachedMajor ? `${reachedMajor}.0.0` : resolved;
}

export function getInstalledCypressMajorVersion(tree?: Tree): number | null {
  const installedCypressVersion = getInstalledCypressVersion(tree);
  return installedCypressVersion ? major(installedCypressVersion) : null;
}

export function assertMinimumCypressVersion(
  minVersion: number,
  tree?: Tree
): void {
  const version = getInstalledCypressMajorVersion(tree);
  if (version && version < minVersion) {
    throw new Error(
      `Cypress version of ${minVersion} or higher is not installed. Expected Cypress v${minVersion}+, found Cypress v${version} instead.`
    );
  }
}
