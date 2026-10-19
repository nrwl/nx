import {
  getDependencyVersionFromPackageJson,
  readJson,
  type Tree,
} from '@nx/devkit';
import {
  getDeclaredPackageVersion,
  getInstalledPackageVersion,
} from '@nx/devkit/internal';
import { join } from 'path';
import { clean, coerce, gte, intersects, major, validRange } from 'semver';

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
export const analogVitestAngular = '~2.7.3';

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
 * Packages that peer vitest, with the first version whose peer range takes
 * vitest 5. Older versions peer vitest 4 and below.
 */
const VITEST_PEERS: Readonly<Record<string, string>> = {
  '@angular/build': '22.2.0',
  '@analogjs/vitest-angular': '2.8.0',
};

function highestMajorTheWorkspacePeersAllow(tree: Tree): number {
  let cap = VITEST_COMPAT[0].major;
  for (const [peer, firstVitestV5Version] of Object.entries(VITEST_PEERS)) {
    if (getDependencyVersionFromPackageJson(tree, peer)) {
      cap = Math.min(
        cap,
        highestVitestMajorAllowedBy(tree, peer, firstVitestV5Version)
      );
    }
  }
  return cap;
}

function highestVitestMajorAllowedBy(
  tree: Tree,
  peer: string,
  firstVitestV5Version: string
): number {
  const installedPeerRange = readInstalledPeerVitestRange(tree, peer);
  if (installedPeerRange) {
    const allowed = VITEST_COMPAT.find((compat) =>
      intersects(`^${compat.major}.0.0`, installedPeerRange)
    );
    if (allowed) {
      return allowed.major;
    }
  }

  const declaredVersion = getDeclaredPackageVersion(tree, peer);
  return declaredVersion && gte(declaredVersion, firstVitestV5Version) ? 5 : 4;
}

function readInstalledPeerVitestRange(tree: Tree, peer: string): string | null {
  const packageJsonPath = `node_modules/${peer}/package.json`;
  if (!tree.exists(packageJsonPath)) {
    return null;
  }
  try {
    const range = readJson(tree, packageJsonPath).peerDependencies?.vitest;
    return typeof range === 'string' && validRange(range) ? range : null;
  } catch {
    return null;
  }
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

export const viteTsconfigPathsVersion = '~4.3.2';
export const viteStaticCopyVersion = '^3.3.0';
