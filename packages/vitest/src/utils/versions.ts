import { getDependencyVersionFromPackageJson, type Tree } from '@nx/devkit';
import { getInstalledPackageVersion } from '@nx/devkit/internal';
import { join } from 'path';
import { clean, coerce, gte, major } from 'semver';

export const nxVersion = require(join('@nx/vitest', 'package.json')).version;
export const minSupportedVitestVersion = '3.0.0';

export const vitestVersion = '~5.0.1';
export const vitestCoverageV8Version = '~5.0.1';
export const vitestCoverageIstanbulVersion = '~5.0.1';
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
  /** Vite range about to be installed, when the workspace declares none yet. */
  viteRange?: string;
};

type VitestVersions = {
  vitestVersion: string;
  vitestCoverageV8Version: string;
  vitestCoverageIstanbulVersion: string;
};

type VitestCompat = {
  major: number;
  /** Floor of this major's own `vite` peer range. */
  minVite: string;
  versions: VitestVersions;
};

// Highest major first. Vitest 3 declares no vite peer at all, so it accepts
// anything and terminates the search.
const VITEST_COMPAT: readonly VitestCompat[] = [
  {
    major: 5,
    minVite: '6.4.0',
    versions: {
      vitestVersion,
      vitestCoverageV8Version,
      vitestCoverageIstanbulVersion,
    },
  },
  {
    major: 4,
    minVite: '6.0.0',
    versions: {
      vitestVersion: '^4.0.0',
      vitestCoverageV8Version: '^4.0.0',
      vitestCoverageIstanbulVersion: '^4.0.0',
    },
  },
  {
    major: 3,
    minVite: '0.0.0',
    versions: {
      vitestVersion: '^3.0.0',
      vitestCoverageV8Version: '^3.0.5',
      vitestCoverageIstanbulVersion: '^3.0.5',
    },
  },
];

export function versions(
  tree: Tree,
  options?: VersionSelectionOptions
): VitestVersions {
  const cap = highestMajorTheWorkspacePeersAllow(tree);

  const installedVitestVersion = getInstalledVitestVersion(tree);
  if (installedVitestVersion) {
    const installedMajor = major(installedVitestVersion);
    if (installedMajor > cap) {
      throw new Error(
        `The installed vitest version "${installedVitestVersion}" is not compatible with this workspace, which has packages that peer vitest ${cap} and below. Pin vitest to ^${cap}.0.0 first.`
      );
    }
    return (
      VITEST_COMPAT.find((compat) => compat.major === installedMajor)
        ?.versions ?? VITEST_COMPAT[0].versions
    );
  }

  // The manifest wins over the caller's range: it carries the minor a
  // major-derived range would drop, and it is what `keepExistingVersions` keeps.
  const viteRange =
    getDependencyVersionFromPackageJson(tree, 'vite') ?? options?.viteRange;
  const viteFloor = viteRange ? coerce(viteRange)?.version : undefined;

  const supported = VITEST_COMPAT.find(
    (compat) =>
      compat.major <= cap && (!viteFloor || gte(viteFloor, compat.minVite))
  );
  return (supported ?? VITEST_COMPAT[0]).versions;
}

/**
 * `@analogjs/vitest-angular` at the version Nx installs, and `@angular/build`,
 * both peer vitest 4. A workspace carrying either cannot take vitest 5.
 */
function highestMajorTheWorkspacePeersAllow(tree: Tree): number {
  return getDependencyVersionFromPackageJson(
    tree,
    '@analogjs/vitest-angular'
  ) || getDependencyVersionFromPackageJson(tree, '@angular/build')
    ? 4
    : 5;
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
