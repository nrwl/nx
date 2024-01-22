import {
  type Tree,
  readProjectConfiguration,
  joinPathFragments,
} from '@nx/devkit';

export function getRemoteIfExists(tree: Tree, remote: string) {
  const remoteProject = getRemote(tree, remote);
  if (!remoteProject) {
    return false;
  }

  const hasModuleFederationConfig =
    tree.exists(
      joinPathFragments(remoteProject.root, 'module-federation.config.ts')
    ) ||
    tree.exists(
      joinPathFragments(remoteProject.root, 'module-federation.config.js')
    );

  return hasModuleFederationConfig ? remoteProject : false;
}

function getRemote(tree: Tree, remote: string) {
  try {
    return readProjectConfiguration(tree, remote);
  } catch {
    return false;
  }
}
