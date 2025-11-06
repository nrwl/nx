import {
  createProjectGraphAsync,
  getDependencyVersionFromPackageJson,
} from '@nx/devkit';
import type { Tree } from 'nx/src/generators/tree';
import { clean, coerce, major } from 'semver';
import {
  vitestCoverageIstanbulVersion,
  vitestCoverageV8Version,
  vitestV1CoverageIstanbulVersion,
  vitestV1CoverageV8Version,
  vitestV1Version,
  vitestV2CoverageIstanbulVersion,
  vitestV2CoverageV8Version,
  vitestV2Version,
  vitestVersion,
} from './versions';

type VitestDependenciesVersions = {
  vitest: string;
  vitestUi: string;
  vitestCoverageV8: string;
  vitestCoverageIstanbul: string;
};

export async function getVitestDependenciesVersionsToInstall(
  tree: Tree
): Promise<VitestDependenciesVersions> {
  if (await isVitestV1(tree)) {
    return {
      vitest: vitestV1Version,
      vitestUi: vitestV1Version,
      vitestCoverageV8: vitestV1CoverageV8Version,
      vitestCoverageIstanbul: vitestV1CoverageIstanbulVersion,
    };
  } else if (await isVitestV2(tree)) {
    return {
      vitest: vitestV2Version,
      vitestUi: vitestV2Version,
      vitestCoverageV8: vitestV2CoverageV8Version,
      vitestCoverageIstanbul: vitestV2CoverageIstanbulVersion,
    };
  } else {
    // Default to latest (v3)
    return {
      vitest: vitestVersion,
      vitestUi: vitestVersion,
      vitestCoverageV8: vitestCoverageV8Version,
      vitestCoverageIstanbul: vitestCoverageIstanbulVersion,
    };
  }
}

export async function isVitestV1(tree: Tree) {
  let installedVitestVersion = await getInstalledVitestVersionFromGraph();
  if (!installedVitestVersion) {
    installedVitestVersion = getInstalledVitestVersion(tree);
  }
  return major(installedVitestVersion) === 1;
}

export async function isVitestV2(tree: Tree) {
  let installedVitestVersion = await getInstalledVitestVersionFromGraph();
  if (!installedVitestVersion) {
    installedVitestVersion = getInstalledVitestVersion(tree);
  }
  return major(installedVitestVersion) === 2;
}

export function getInstalledVitestVersion(tree: Tree): string {
  const installedVitestVersion = getDependencyVersionFromPackageJson(
    tree,
    'vitest'
  );

  if (
    !installedVitestVersion ||
    installedVitestVersion === 'latest' ||
    installedVitestVersion === 'beta'
  ) {
    return clean(vitestVersion) ?? coerce(vitestVersion).version;
  }

  return (
    clean(installedVitestVersion) ?? coerce(installedVitestVersion).version
  );
}

export function getInstalledViteVersion(tree: Tree): string {
  const installedViteVersion = getDependencyVersionFromPackageJson(
    tree,
    'vite'
  );

  if (
    !installedViteVersion ||
    installedViteVersion === 'latest' ||
    installedViteVersion === 'beta'
  ) {
    return clean(vitestVersion) ?? coerce(vitestVersion).version;
  }

  return clean(installedViteVersion) ?? coerce(installedViteVersion).version;
}

export function getInstalledViteMajorVersion(
  tree: Tree
): 5 | 6 | 7 | undefined {
  const installedViteVersion = getInstalledViteVersion(tree);
  if (!installedViteVersion) {
    return;
  }

  const installedMajor = major(installedViteVersion);
  if (installedMajor < 5 || installedMajor > 7) {
    return undefined;
  }
  return installedMajor as 5 | 6 | 7;
}

export async function getInstalledVitestVersionFromGraph() {
  const graph = await createProjectGraphAsync();
  const vitestDep = graph.externalNodes?.['npm:vitest'];
  if (!vitestDep) {
    return undefined;
  }
  return (
    clean(vitestDep.data.version) ?? coerce(vitestDep.data.version).version
  );
}
