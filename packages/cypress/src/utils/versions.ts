import { readJson, type Tree } from '@nx/devkit';
import type { PackageJson } from 'nx/src/utils/package-json';
import { clean, coerce, major } from 'semver';

export const nxVersion = require('../../package.json').version;
export const eslintPluginCypressVersion = '^3.5.0';
export const typesNodeVersion = '20.19.9';
export const cypressViteDevServerVersion = '^6.0.3';
export const cypressVersion = '^14.2.1';
export const cypressWebpackVersion = '^4.0.2';
export const viteVersion = '^6.0.0';
export const htmlWebpackPluginVersion = '^5.5.0';

const latestVersions: Omit<
  typeof import('./versions'),
  'versions' | 'getInstalledCypressMajorVersion' | 'assertMinimumCypressVersion'
> = {
  nxVersion,
  eslintPluginCypressVersion,
  typesNodeVersion,
  cypressViteDevServerVersion,
  cypressVersion,
  cypressWebpackVersion,
  viteVersion,
  htmlWebpackPluginVersion,
};

export function versions(
  tree: Tree,
  cypressMajorVersion = getInstalledCypressMajorVersion(tree)
) {
  if (!cypressMajorVersion) {
    return latestVersions;
  }

  if (cypressMajorVersion > 14) {
    throw new Error(`Unsupported Cypress version: ${cypressVersion}`);
  }

  if (cypressMajorVersion === 14) {
    return latestVersions;
  }

  return {
    nxVersion,
    eslintPluginCypressVersion: '^3.5.0',
    typesNodeVersion: '20.19.9',
    cypressViteDevServerVersion: '^2.2.1',
    cypressVersion: '^13.13.0',
    cypressWebpackVersion: '^3.8.0',
    viteVersion: '~5.0.0',
    htmlWebpackPluginVersion: '^5.5.0',
  };
}

export function getInstalledCypressMajorVersion(tree?: Tree): number | null {
  try {
    let version: string | null;

    if (tree) {
      version = getCypressVersionFromTree(tree);
    } else {
      version = getCypressVersionFromFileSystem();
    }

    return version ? major(version) : null;
  } catch {
    return null;
  }
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
  const packageJson = readJson(tree, 'package.json');
  const installedVersion =
    packageJson.devDependencies?.cypress ?? packageJson.dependencies?.cypress;

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
