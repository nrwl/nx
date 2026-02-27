import {
  createProjectGraphAsync,
  getDependencyVersionFromPackageJson,
} from '@nx/devkit';
import type { Tree } from 'nx/src/generators/tree';
import { clean, coerce, major } from 'semver';
import {
  h3Version,
  nuxtDevtoolsVersion,
  nuxtDevtoolsV3Version,
  nuxtKitV3Version,
  nuxtKitVersion,
  nuxtUiTemplatesVersion,
  nuxtV3Version,
  nuxtVersion,
} from './versions';

export type NuxtDependenciesVersions = {
  nuxt: string;
  nuxtKit: string;
  h3: string;
  nuxtDevtools: string;
  nuxtUiTemplates: string;
};

export async function getNuxtDependenciesVersionsToInstall(
  tree: Tree
): Promise<NuxtDependenciesVersions> {
  if (await isNuxtV3(tree)) {
    return {
      nuxt: nuxtV3Version,
      nuxtKit: nuxtKitV3Version,
      h3: h3Version,
      nuxtDevtools: nuxtDevtoolsV3Version,
      nuxtUiTemplates: nuxtUiTemplatesVersion,
    };
  } else {
    // Default to latest (v4)
    return {
      nuxt: nuxtVersion,
      nuxtKit: nuxtKitVersion,
      h3: h3Version,
      nuxtDevtools: nuxtDevtoolsVersion,
      nuxtUiTemplates: nuxtUiTemplatesVersion,
    };
  }
}

export async function isNuxtV3(tree: Tree): Promise<boolean> {
  let installedNuxtVersion = await getInstalledNuxtVersionFromGraph();
  if (!installedNuxtVersion) {
    installedNuxtVersion = getInstalledNuxtVersion(tree);
  }
  if (!installedNuxtVersion) {
    return false; // No Nuxt installed, default to v4
  }
  return major(installedNuxtVersion) === 3;
}

export async function isNuxtV4(tree: Tree): Promise<boolean> {
  let installedNuxtVersion = await getInstalledNuxtVersionFromGraph();
  if (!installedNuxtVersion) {
    installedNuxtVersion = getInstalledNuxtVersion(tree);
  }
  if (!installedNuxtVersion) {
    return true; // No Nuxt installed, default to v4
  }
  return major(installedNuxtVersion) >= 4;
}

export function getInstalledNuxtVersion(tree: Tree): string | undefined {
  const installedNuxtVersion = getDependencyVersionFromPackageJson(
    tree,
    'nuxt'
  );

  if (
    !installedNuxtVersion ||
    installedNuxtVersion === 'latest' ||
    installedNuxtVersion === 'beta'
  ) {
    return undefined;
  }

  return clean(installedNuxtVersion) ?? coerce(installedNuxtVersion)?.version;
}

export function getInstalledNuxtMajorVersion(tree: Tree): 3 | 4 | undefined {
  const installedNuxtVersion = getInstalledNuxtVersion(tree);
  if (!installedNuxtVersion) {
    return undefined;
  }

  const installedMajor = major(installedNuxtVersion);
  if (installedMajor < 3 || installedMajor > 4) {
    return undefined;
  }
  return installedMajor as 3 | 4;
}

export async function getInstalledNuxtVersionFromGraph(): Promise<
  string | undefined
> {
  try {
    const graph = await createProjectGraphAsync();
    const nuxtDep = graph.externalNodes?.['npm:nuxt'];
    if (!nuxtDep) {
      return undefined;
    }
    return clean(nuxtDep.data.version) ?? coerce(nuxtDep.data.version)?.version;
  } catch {
    return undefined;
  }
}
