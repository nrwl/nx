import { Tree } from '@nx/devkit';

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

  if (tree.exists('jest.preset.cjs')) {
    return 'jest.preset.cjs';
  }

  return null;
}
