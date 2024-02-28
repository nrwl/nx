import type { Tree } from '@nx/devkit';

export function findRootJestConfig(tree: Tree): string | null {
  if (tree.exists('jest.config.js')) {
    return 'jest.config.js';
  }

  if (tree.exists('jest.config.ts')) {
    return 'jest.config.ts';
  }

  return null;
}
