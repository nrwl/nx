import { normalizePath } from '@nx/devkit';

export type NameInfo = { name: string; path: string };

export function parseNameWithPath(rawName: string): NameInfo {
  const parsedName = normalizePath(rawName).split('/');
  const name = parsedName.pop();
  const path = parsedName.join('/');

  return { name, path };
}
