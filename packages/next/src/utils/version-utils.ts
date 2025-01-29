import { type Tree, readJson, createProjectGraphAsync } from '@nx/devkit';
import { clean, coerce, major } from 'semver';
import { nextVersion, next14Version } from './versions';

type NextDependenciesVersions = {
  next: string;
};

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

export async function isNext14(tree: Tree) {
  let installedNextVersion = await getInstalledNextVersionFromGraph();
  if (!installedNextVersion) {
    installedNextVersion = getInstalledNextVersion(tree);
  }
  return major(installedNextVersion) === 14;
}

export function getInstalledNextVersion(tree: Tree): string {
  const pkgJson = readJson(tree, 'package.json');
  const installedNextVersion =
    pkgJson.dependencies && pkgJson.dependencies['next'];

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
