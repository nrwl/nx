import { joinPathFragments, type Tree } from '@nx/devkit';

export function findRootJestConfig(tree: Tree): string | null {
  if (tree.exists('jest.config.js')) {
    return 'jest.config.js';
  }

  if (tree.exists('jest.config.ts')) {
    return 'jest.config.ts';
  }

  if (tree.exists('jest.config.cts')) {
    return 'jest.config.cts';
  }

  return null;
}

export function findProjectJestConfig(
  tree: Tree,
  projectRoot: string
): string | null {
  const extensions = ['js', 'ts', 'cts'];

  for (const ext of extensions) {
    const configPath = joinPathFragments(projectRoot, `jest.config.${ext}`);
    if (tree.exists(configPath)) {
      return configPath;
    }
  }

  return null;
}
