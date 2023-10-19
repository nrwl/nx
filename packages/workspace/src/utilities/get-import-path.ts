import { Tree } from 'nx/src/generators/tree';
import { readJson } from 'nx/src/generators/utils/json';

export function getImportPath(tree: Tree, projectDirectory: string): string {
  const npmScope = getNpmScope(tree);
  return npmScope
    ? `${npmScope === '@' ? '' : '@'}${npmScope}/${projectDirectory}`
    : projectDirectory;
}

export function getNpmScope(tree: Tree) {
  const { name } = tree.exists('package.json')
    ? readJson<{ name?: string }>(tree, 'package.json')
    : { name: null };

  if (name?.startsWith('@')) {
    return name.split('/')[0].substring(1);
  }
}
