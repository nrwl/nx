import { Tree, readNxJson, readJson } from '@nx/devkit';

/**
 * Read the npm scope that a workspace should use by default
 */
export function getNpmScope(tree: Tree): string | undefined {
  const nxJson = readNxJson(tree);

  // TODO(v17): Remove reading this from nx.json
  if (nxJson?.npmScope) {
    return nxJson.npmScope;
  }

  const { name } = tree.exists('package.json')
    ? readJson<{ name?: string }>(tree, 'package.json')
    : { name: null };

  if (name?.startsWith('@')) {
    return name.split('/')[0].substring(1);
  }
}
