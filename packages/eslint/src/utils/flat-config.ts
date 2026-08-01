import { Tree } from '@nx/devkit';

export const eslintFlatConfigFilenames = [
  'eslint.config.cjs',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cts',
  'eslint.config.ts',
  'eslint.config.mts',
];

export const baseEslintConfigFilenames = [
  'eslint.base.js',
  'eslint.base.ts',
  'eslint.base.config.cjs',
  'eslint.base.config.js',
  'eslint.base.config.mjs',
  'eslint.base.config.cts',
  'eslint.base.config.ts',
  'eslint.base.config.mts',
];

export const eslintrcFilenames = [
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.yaml',
  '.eslintrc.yml',
  '.eslintrc.json',
];

export function getRootESLintFlatConfigFilename(tree: Tree): string {
  for (const file of eslintFlatConfigFilenames) {
    if (tree.exists(file)) {
      return file;
    }
  }
  throw new Error('Could not find root flat config file');
}

export function useFlatConfig(tree?: Tree): boolean {
  // ESLint's own environment variable wins when set.
  if (process.env.ESLINT_USE_FLAT_CONFIG === 'true') {
    return true;
  } else if (process.env.ESLINT_USE_FLAT_CONFIG === 'false') {
    return false;
  }

  if (tree) {
    // An existing flat config at the root means the workspace is on flat config.
    if (eslintFlatConfigFilenames.some((filename) => tree.exists(filename))) {
      return true;
    }
    // An existing eslintrc config means the workspace is still on eslintrc, which
    // we keep supporting; don't force it onto flat config.
    if (eslintrcFilenames.some((filename) => tree.exists(filename))) {
      return false;
    }
  }

  // Nothing to go on: default to flat config, the default for every supported
  // ESLint version (v9+).
  return true;
}
