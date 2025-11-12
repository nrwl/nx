import {
  type Tree,
  createProjectGraphAsync,
  getDependencyVersionFromPackageJson,
} from '@nx/devkit';
import { clean, coerce, major } from 'semver';
import {
  reactDomV18Version,
  reactDomVersion,
  reactIsV18Version,
  reactIsVersion,
  reactV18Version,
  reactVersion,
  typesReactDomV18Version,
  typesReactDomVersion,
  typesReactIsV18Version,
  typesReactIsVersion,
  typesReactV18Version,
  typesReactVersion,
} from './versions.js';

type ReactDependenciesVersions = {
  react: string;
  'react-dom': string;
  'react-is': string;
  '@types/react': string;
  '@types/react-dom': string;
  '@types/react-is': string;
};

export async function getReactDependenciesVersionsToInstall(
  tree: Tree
): Promise<ReactDependenciesVersions> {
  if (await isReact18(tree)) {
    return {
      react: reactV18Version,
      'react-dom': reactDomV18Version,
      'react-is': reactIsV18Version,
      '@types/react': typesReactV18Version,
      '@types/react-dom': typesReactDomV18Version,
      '@types/react-is': typesReactIsV18Version,
    };
  } else {
    return {
      react: reactVersion,
      'react-dom': reactDomVersion,
      'react-is': reactIsVersion,
      '@types/react': typesReactVersion,
      '@types/react-dom': typesReactDomVersion,
      '@types/react-is': typesReactIsVersion,
    };
  }
}

export async function isReact18(tree: Tree) {
  let installedReactVersion = await getInstalledReactVersionFromGraph();
  if (!installedReactVersion) {
    installedReactVersion = getInstalledReactVersion(tree);
  }
  return major(installedReactVersion) === 18;
}

export function getInstalledReactVersion(tree: Tree): string {
  const installedReactVersion = getDependencyVersionFromPackageJson(
    tree,
    'react'
  );

  if (
    !installedReactVersion ||
    installedReactVersion === 'latest' ||
    installedReactVersion === 'next'
  ) {
    return clean(reactVersion) ?? coerce(reactVersion).version;
  }

  return clean(installedReactVersion) ?? coerce(installedReactVersion).version;
}

export async function getInstalledReactVersionFromGraph() {
  const graph = await createProjectGraphAsync();
  const reactDep = graph.externalNodes?.['npm:react'];
  if (!reactDep) {
    return undefined;
  }
  return clean(reactDep.data.version) ?? coerce(reactDep.data.version).version;
}
