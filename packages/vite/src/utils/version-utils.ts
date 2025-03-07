import type { Tree } from 'nx/src/generators/tree';
import {
  vitestVersion,
  vitestV1Version,
  vitestCoverageV8Version,
  vitestV1CoverageV8Version,
  vitestCoverageIstanbulVersion,
  vitestV1CoverageIstanbulVersion,
} from './versions';
import { clean, coerce, major } from 'semver';
import { readJson, createProjectGraphAsync } from '@nx/devkit';

type VitestDependenciesVersions = {
  vitest: string;
  vitestCoverageV8: string;
  vitestCoverageIstanbul: string;
};

export async function getVitestDependenciesVersionsToInstall(
  tree: Tree
): Promise<VitestDependenciesVersions> {
  if (await isVitestV1(tree)) {
    return {
      vitest: vitestV1Version,
      vitestCoverageV8: vitestV1CoverageV8Version,
      vitestCoverageIstanbul: vitestV1CoverageIstanbulVersion,
    };
  } else {
    return {
      vitest: vitestVersion,
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

export function getInstalledVitestVersion(tree: Tree): string {
  const pkgJson = readJson(tree, 'package.json');
  const installedVitestVersion =
    pkgJson.dependencies && pkgJson.dependencies['vitest'];

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
