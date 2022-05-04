import * as path from 'path';
import { Tree } from '../generators/tree';
import { readJson } from '../generators/utils/json';
import { readNxJson } from '../generators/utils/project-configuration';

function removeWindowsDriveLetter(osSpecificPath: string): string {
  return osSpecificPath.replace(/^[A-Z]:/, '');
}

/**
 * Coverts an os specific path to a unix style path
 */
export function normalizePath(osSpecificPath: string): string {
  return removeWindowsDriveLetter(osSpecificPath).split('\\').join('/');
}

/**
 * Normalized path fragments and joins them
 */
export function joinPathFragments(...fragments: string[]): string {
  return normalizePath(path.join(...fragments));
}

/**
 * Detect workspace scope from the package.json name
 * @param packageName
 * @returns
 */
export function detectWorkspaceScope(packageName: string): string {
  if (!packageName) return '';

  if (packageName.startsWith('@')) {
    return packageName.substring(1).split('/')[0];
  }

  if (packageName.includes('/')) {
    return packageName.split('/')[0];
  }

  return '';
}

/**
 * Prefixes project name with npm scope
 */
export function getImportPath(
  npmScope: string,
  projectDirectory: string
): string {
  return npmScope ? `@${npmScope}/${projectDirectory}` : projectDirectory;
}
