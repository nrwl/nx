import {
  type Tree,
  createProjectGraphAsync,
  getDependencyVersionFromPackageJson,
} from '@nx/devkit';
import { clean, coerce, major } from 'semver';
import {
  nextVersion,
  next14Version,
  eslintConfigNext14Version,
  eslintConfigNextVersion,
} from './versions';

type NextDependenciesVersions = {
  next: string;
};

type EslintConfigNextVersion = string;

export async function getNextDependenciesVersionsToInstall(
  tree: Tree,
  isReact18 = false
): Promise<NextDependenciesVersions> {
  if (await isNext14(tree)) {
    return {
      next: next14Version,
    };
  } else {
    return {
      next: nextVersion,
    };
  }
}

export async function getEslintConfigNextDependenciesVersionsToInstall(
  tree: Tree
): Promise<EslintConfigNextVersion> {
  if (await isNext14(tree)) {
    return eslintConfigNext14Version;
  } else {
    return eslintConfigNextVersion;
  }
}

export async function isNext14(tree: Tree) {
  let installedNextVersion = await getInstalledNextVersionFromGraph();
  if (!installedNextVersion) {
    installedNextVersion = getInstalledNextVersion(tree);
  }
  return major(installedNextVersion) === 14;
}

export function getInstalledNextVersion(tree: Tree): string {
  const installedNextVersion = getDependencyVersionFromPackageJson(
    tree,
    'next'
  );

  if (
    !installedNextVersion ||
    installedNextVersion === 'latest' ||
    installedNextVersion === 'next'
  ) {
    return clean(nextVersion) ?? coerce(nextVersion).version;
  }

  return clean(installedNextVersion) ?? coerce(installedNextVersion).version;
}

export async function getInstalledNextVersionFromGraph() {
  const graph = await createProjectGraphAsync();
  const nextDep = graph.externalNodes?.['npm:next'];
  if (!nextDep) {
    return undefined;
  }
  return clean(nextDep.data.version) ?? coerce(nextDep.data.version).version;
}
