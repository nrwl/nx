import { getDependencyVersionFromPackageJson, type Tree } from '@nx/devkit';
import {
  getInstalledPackageVersion,
  getResolvedPackageVersion,
  getSatisfyingInstalledPackageVersion,
} from '@nx/devkit/internal';
import { join } from 'path';
import { coerce, intersects, lt, major, validRange } from 'semver';

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
    | 'assertViteSupportsInstalledCypress'
    | 'componentTestingVersions'
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

// A fresh Vite component testing setup on an older Vite gets the last set
// that runs on it; Cypress 16 only runs on Vite 8.
export function componentTestingVersions(
  tree: Tree,
  bundler: 'vite' | 'webpack' | undefined
): CypressVersions {
  if (
    bundler === 'vite' &&
    !getInstalledCypressVersion(tree) &&
    getViteVersionBelowCypress16Floor(tree)
  ) {
    return versionMap[15];
  }
  return versions(tree);
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

  // No installed Cypress satisfies the range. A clean install of a satisfiable
  // range lands on the highest version it admits, so follow the highest
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

export function assertViteSupportsInstalledCypress(tree: Tree): void {
  const cypressMajor = getInstalledCypressMajorVersion(tree);
  const viteVersion = getViteVersionBelowCypress16Floor(tree);
  if (cypressMajor >= 16 && viteVersion) {
    throw new Error(
      `Cypress ${cypressMajor} component testing requires Vite 8. Found Vite ${viteVersion}. Update Vite to 8 or use Cypress 15.`
    );
  }
}

// Cypress 16 component testing rejects a Vite below 8. Its dev server
// package peers `vite ^8.0.0`, which also excludes 8 prereleases.
function getViteVersionBelowCypress16Floor(tree: Tree): string | null {
  const viteVersion = getResolvedPackageVersion(tree, 'vite');
  return viteVersion && lt(viteVersion, '8.0.0') ? viteVersion : null;
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
