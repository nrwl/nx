import {
  createProjectGraphAsync,
  getDependencyVersionFromPackageJson,
} from '@nx/devkit';
import type { Tree } from 'nx/src/generators/tree';
import { clean, coerce, major } from 'semver';
import {
  vitestCoverageIstanbulVersion,
  vitestCoverageV8Version,
  vitestV3CoverageIstanbulVersion,
  vitestV3CoverageV8Version,
  vitestV3Version,
  vitestV2CoverageIstanbulVersion,
  vitestV2CoverageV8Version,
  vitestV2Version,
  vitestVersion,
} from './versions';

type VitestDependenciesVersions = {
  vitest: string;
  vitestCoverageV8: string;
  vitestCoverageIstanbul: string;
};

export async function getVitestDependenciesVersionsToInstall(
  tree: Tree
): Promise<VitestDependenciesVersions> {
  if (await isVitestV3(tree)) {
    return {
      vitest: vitestV3Version,
      vitestCoverageV8: vitestV3CoverageV8Version,
      vitestCoverageIstanbul: vitestV3CoverageIstanbulVersion,
    };
  } else if (await isVitestV2(tree)) {
    return {
      vitest: vitestV2Version,
      vitestCoverageV8: vitestV2CoverageV8Version,
      vitestCoverageIstanbul: vitestV2CoverageIstanbulVersion,
    };
  } else {
    // Default to latest (v4)
    return {
      vitest: vitestVersion,
      vitestCoverageV8: vitestCoverageV8Version,
      vitestCoverageIstanbul: vitestCoverageIstanbulVersion,
    };
  }
}

export async function isVitestV3(tree: Tree) {
  let installedVitestVersion = await getInstalledVitestVersionFromGraph();
  if (!installedVitestVersion) {
    installedVitestVersion = getInstalledVitestVersion(tree);
  }
  return major(installedVitestVersion) === 3;
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
