import { Tree } from '@nrwl/devkit';

export function findRootJestConfig(tree: Tree): string | null {
  if (tree.exists('jest.config.js')) {
    return 'jest.config.js';
  }

  if (tree.exists('jest.config.ts')) {
    return 'jest.config.ts';
  }

  return null;
}

export function findRootJestPreset(tree: Tree): string | null {
  if (tree.exists('jest.preset.js')) {
    return 'jest.preset.js';
  }

  return null;
}
