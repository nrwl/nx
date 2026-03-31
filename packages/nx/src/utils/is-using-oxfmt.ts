import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Tree } from '../generators/tree';

const configFiles = [
  '.oxfmtrc.json',
  '.oxfmtrc.jsonc',
  'oxfmt.config.ts',
  'oxfmt.config.mts',
  'oxfmt.config.cts',
  'oxfmt.config.js',
  'oxfmt.config.mjs',
  'oxfmt.config.cjs',
];

export function isUsingOxfmt(root: string) {
  for (const file of configFiles) {
    if (existsSync(join(root, file))) {
      return true;
    }
  }
  return false;
}

export function isUsingOxfmtInTree(tree: Tree) {
  for (const file of configFiles) {
    if (tree.exists(file)) {
      return true;
    }
  }
  return false;
}
