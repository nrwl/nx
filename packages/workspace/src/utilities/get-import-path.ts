import { Tree } from 'nx/src/generators/tree';
import { readNxJson } from 'nx/src/generators/utils/nx-json';
import { readJson } from 'nx/src/generators/utils/json';

export function getImportPath(tree: Tree, projectDirectory: string): string {
  const npmScope = getNpmScope(tree);
  return npmScope
    ? `${npmScope === '@' ? '' : '@'}${npmScope}/${projectDirectory}`
    : projectDirectory;
}

function getNpmScope(tree: Tree) {
  const nxJson = readNxJson(tree);

  // TODO(v17): Remove reading this from nx.json
  if (nxJson.npmScope) {
    return nxJson.npmScope;
  }

  const { name } = tree.exists('package.json')
    ? readJson<{ name?: string }>(tree, 'package.json')
    : { name: null };

  if (name?.startsWith('@')) {
    return name.split('/')[0].substring(1);
  }
}
