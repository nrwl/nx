import { getDependencyVersionFromPackageJson, type Tree } from '@nx/devkit';
import { getInstalledPackageVersion } from '@nx/devkit/internal';
import { clean, coerce, major } from 'semver';

export const nxVersion = require('../../package.json').version;
export const minSupportedCypressVersion = '13.0.0';
export const eslintPluginCypressVersion = '^3.5.0';
export const typesNodeVersion = '^22.0.0';
export const cypressViteDevServerVersion = '^7.3.1';
export const cypressVersion = '^15.14.2';
export const cypressWebpackVersion = '^5.4.1';
export const viteVersion = '^6.0.0';
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

type CompatVersions = 13 | 14;
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
};

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

  const installedVersion = getDependencyVersionFromPackageJson(tree, 'cypress');
  if (!installedVersion) {
    return null;
  }
  if (installedVersion === 'latest' || installedVersion === 'next') {
    return clean(cypressVersion) ?? coerce(cypressVersion)?.version ?? null;
  }
  return clean(installedVersion) ?? coerce(installedVersion)?.version ?? null;
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
