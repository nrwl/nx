import { normalize } from 'path';

export function pathStartsWith(path1: string, path2: string) {
  path1 = normalize(path1).replace(/\\/g, '/');
  path2 = normalize(path2).replace(/\\/g, '/');

  return path1.startsWith(path2);
}
