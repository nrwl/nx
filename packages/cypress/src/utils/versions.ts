import { getDependencyVersionFromPackageJson, type Tree } from '@nx/devkit';
import type { PackageJson } from 'nx/src/utils/package-json';
import { clean, coerce, major } from 'semver';

export const nxVersion = require('nx/package.json').version;
export const eslintPluginCypressVersion = '^3.5.0';
export const typesNodeVersion = '20.19.9';
export const cypressViteDevServerVersion = '^7.0.1';
export const cypressVersion = '^15.6.0';
export const cypressWebpackVersion = '^5.1.4';
export const viteVersion = '^6.0.0';
export const htmlWebpackPluginVersion = '^5.5.0';

export type CypressVersions = Record<
  keyof Omit<
    typeof import('./versions'),
    | 'nxVersion'
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
    typesNodeVersion: '20.19.9',
    cypressViteDevServerVersion: '^2.2.1',
    cypressVersion: '^13.13.0',
    cypressWebpackVersion: '^3.8.0',
    viteVersion: '~5.0.0',
    htmlWebpackPluginVersion: '^5.5.0',
  },
  14: {
    eslintPluginCypressVersion: '^3.5.0',
    typesNodeVersion: '20.19.9',
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
  switch (cypressMajorVersion) {
    case 15:
      return latestVersions;
    case 14:
      return versionMap[14];
    case 13:
      return versionMap[13];
    default:
      throw new Error(
        `You're currently using an unsupported Cypress version: ${installedCypressVersion}. Supported versions are v13, v14, and v15.`
      );
  }
}

export function getInstalledCypressVersion(tree?: Tree): string | null {
  try {
    let version: string | null;

    if (tree) {
      version = getCypressVersionFromTree(tree);
    } else {
      version = getCypressVersionFromFileSystem();
    }

    return version;
  } catch {
    return null;
  }
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

function getCypressVersionFromTree(tree: Tree): string | null {
  const installedVersion = getDependencyVersionFromPackageJson(tree, 'cypress');

  if (!installedVersion) {
    return null;
  }

  if (installedVersion === 'latest' || installedVersion === 'next') {
    return clean(cypressVersion) ?? coerce(cypressVersion)?.version;
  }

  return clean(installedVersion) ?? coerce(installedVersion)?.version;
}

function getCypressVersionFromFileSystem(): string | null {
  let packageJson: PackageJson | undefined;
  try {
    packageJson = <PackageJson>require('cypress/package.json');
  } catch {}

  if (!packageJson) {
    return null;
  }

  return packageJson.version;
}
