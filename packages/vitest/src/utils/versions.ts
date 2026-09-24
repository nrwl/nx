import { getDependencyVersionFromPackageJson, type Tree } from '@nx/devkit';
import { getInstalledPackageVersion } from '@nx/devkit/internal';
import { join } from 'path';
import { clean, coerce, gte, major } from 'semver';

export const nxVersion = require(join('@nx/vitest', 'package.json')).version;
export const minSupportedVitestVersion = '3.0.0';

export const vitestVersion = '~5.0.1';
export const vitestCoverageV8Version = '~5.0.1';
export const vitestCoverageIstanbulVersion = '~5.0.1';
// Each vitest major's own `vite` peer floor. Vitest 3 declares no vite peer at
// all, so it is the only option left on vite 5.
const MIN_VITE_BY_VITEST_MAJOR = { 5: '6.4.0', 4: '6.0.0' } as const;
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

export type VersionSelectionOptions = {
  /** Vite major about to be installed, which may not be in `package.json` yet. */
  viteMajorVersion?: number;
  /** Framework the caller is configuring, which may pull in its own peers. */
  uiFramework?: string;
};

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

type CompatVersions = 3 | 4;
const versionMap: Record<CompatVersions, VitestVersions> = {
  3: {
    vitestVersion: '^3.0.0',
    vitestCoverageV8Version: '^3.0.5',
    vitestCoverageIstanbulVersion: '^3.0.5',
  },
  4: {
    vitestVersion: '^4.0.0',
    vitestCoverageV8Version: '^4.0.0',
    vitestCoverageIstanbulVersion: '^4.0.0',
  },
};

export function versions(
  tree: Tree,
  options?: VersionSelectionOptions
): VitestVersions {
  const installedVitestVersion = getInstalledVitestVersion(tree);
  if (installedVitestVersion) {
    const vitestMajorVersion = major(installedVitestVersion);
    return versionMap[vitestMajorVersion as CompatVersions] ?? latestVersions;
  }

  const supported = highestSupportedVitestMajor(tree, options);
  return versionMap[supported as CompatVersions] ?? latestVersions;
}

/**
 * Nothing pins vitest yet, so the rest of the workspace decides which major it
 * can actually install.
 */
function highestSupportedVitestMajor(
  tree: Tree,
  options?: VersionSelectionOptions
): number {
  // `@analogjs/vitest-angular`, which the Angular setup pulls in, has no vitest
  // 5 peer yet. The framework is checked alongside the manifest because the
  // configuration generator adds analog in the same pass, so it is not in
  // `package.json` yet when this runs.
  if (
    options?.uiFramework === 'angular' ||
    getDependencyVersionFromPackageJson(tree, '@analogjs/vitest-angular')
  ) {
    return 4;
  }

  const viteVersionToUse =
    options?.viteMajorVersion !== undefined
      ? `${options.viteMajorVersion}.0.0`
      : getDependencyVersionFromPackageJson(tree, 'vite');
  if (!viteVersionToUse) {
    // No vite either, so init installs the latest alongside vitest.
    return 5;
  }

  // Coerce to the range's floor: `^6.0.0` may resolve to 6.4+, but pairing on
  // what the manifest guarantees keeps the installed set satisfiable.
  const coerced = coerce(viteVersionToUse);
  if (!coerced) return 5;
  if (gte(coerced.version, MIN_VITE_BY_VITEST_MAJOR[5])) return 5;
  if (gte(coerced.version, MIN_VITE_BY_VITEST_MAJOR[4])) return 4;
  return 3;
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
