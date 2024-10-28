import { Tree } from '@nx/devkit';
import { gte } from 'semver';

// todo: add support for eslint.config.mjs,
export const eslintFlatConfigFilenames = [
  'eslint.config.js',
  'eslint.config.cjs',
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
  // Prioritize taking ESLint's own environment variable into account when determining if we should use flat config
  // If it is not defined, then default to true.
  if (process.env.ESLINT_USE_FLAT_CONFIG === 'true') {
    return true;
  } else if (process.env.ESLINT_USE_FLAT_CONFIG === 'false') {
    return false;
  }

  // If we find an existing flat config file in the root of the provided tree, we should use flat config
  if (tree) {
    const hasRootFlatConfig = eslintFlatConfigFilenames.some((filename) =>
      tree.exists(filename)
    );
    if (hasRootFlatConfig) {
      return true;
    }
  }

  // Otherwise fallback to checking the installed eslint version
  try {
    const { ESLint } = require('eslint');
    // Default to any v8 version to compare against in this case as it implies a much older version of ESLint was found (and gte() requires a valid version)
    const eslintVersion = ESLint.version || '8.0.0';
    return gte(eslintVersion, '9.0.0');
  } catch {
    // Default to assuming flat config in case ESLint is not yet installed
    return true;
  }
}
