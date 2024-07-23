import { Tree } from '@nx/devkit';

// todo: add support for eslint.config.mjs,
export const eslintFlatConfigFilenames = [
  'eslint.config.js',
  'eslint.config.cjs',
];

export function flatConfigEslintFilename(tree: Tree): string {
  for (const file of eslintFlatConfigFilenames) {
    if (tree.exists(file)) {
      return file;
    }
  }
  throw new Error('Could not find flat config file');
}

export function useFlatConfig(tree: Tree): boolean {
  try {
    return !!flatConfigEslintFilename(tree);
  } catch {
    return false;
  }
}
