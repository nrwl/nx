import { Tree } from '@nx/devkit';
import { getNpmScope } from './package-json/get-npm-scope';

/**
 * Prefixes project name with npm scope
 */
export function getImportPath(tree: Tree, projectDirectory: string): string {
  const npmScope = getNpmScope(tree);
  return npmScope
    ? `${npmScope === '@' ? '' : '@'}${npmScope}/${projectDirectory}`
    : projectDirectory;
}
