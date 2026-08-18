import { getDependencyVersionFromPackageJson, type Tree } from '@nx/devkit';
import { getInstalledPackageVersion } from '@nx/devkit/internal';
import { join } from 'path';
import { clean, coerce, major } from 'semver';

export const nxVersion = require(join('@nx/vitest', 'package.json')).version;
export const minSupportedVitestVersion = '3.0.0';

export const vitestVersion = '~4.1.0';
export const vitestCoverageV8Version = '~4.1.0';
export const vitestCoverageIstanbulVersion = '~4.1.0';
export const viteVersion = '^8.0.0';
export const viteV7Version = '^7.0.0';
export const viteV6Version = '^6.0.0';
export const viteV5Version = '^5.0.0';
export const vitePluginReactVersion = '^6.0.0';
export const vitePluginReactV4Version = '^4.2.0';
export const vitePluginReactSwcVersion = '^4.3.0';
export const jsdomVersion = '^27.1.0';
export const vitePluginDtsVersion = '~4.5.0';
export const ajvVersion = '^8.0.0';
export const happyDomVersion = '^20.10.4';
export const edgeRuntimeVmVersion = '~3.0.2';
export const jitiVersion = '2.4.2';
export const analogVitestAngular = '~2.6.0';

type VitestVersions = {
  vitestVersion: string;
  vitestCoverageV8Version: string;
  vitestCoverageIstanbulVersion: string;
};

const latestVersions: VitestVersions = {
  vitestVersion,
  vitestCoverageV8Version,
  vitestCoverageIstanbulVersion,
};

type CompatVersions = 3;
const versionMap: Record<CompatVersions, VitestVersions> = {
  3: {
    vitestVersion: '^3.0.0',
    vitestCoverageV8Version: '^3.0.5',
    vitestCoverageIstanbulVersion: '^3.0.5',
  },
};

export function versions(tree: Tree): VitestVersions {
  const installedVitestVersion = getInstalledVitestVersion(tree);
  if (!installedVitestVersion) {
    return latestVersions;
  }
  const vitestMajorVersion = major(installedVitestVersion);
  return versionMap[vitestMajorVersion as CompatVersions] ?? latestVersions;
}

export function getInstalledVitestVersion(tree?: Tree): string | null {
  if (!tree) {
    return getInstalledPackageVersion('vitest');
  }

  const installedVersion = getDependencyVersionFromPackageJson(tree, 'vitest');
  if (!installedVersion) {
    return null;
  }
  if (installedVersion === 'latest' || installedVersion === 'next') {
    return clean(vitestVersion) ?? coerce(vitestVersion)?.version ?? null;
  }
  return clean(installedVersion) ?? coerce(installedVersion)?.version ?? null;
}

export function getInstalledVitestMajorVersion(tree?: Tree): number | null {
  const installedVitestVersion = getInstalledVitestVersion(tree);
  return installedVitestVersion ? major(installedVitestVersion) : null;
}
