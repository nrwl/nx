import { Tree } from '@nx/devkit';
import { gte } from 'semver';
import { resolveESLintClassSync } from './resolve-eslint-class';

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

export function useFlatConfig(tree: Tree): boolean {
  const hasRootFlatConfig = eslintFlatConfigFilenames.some((filename) =>
    tree.exists(filename)
  );
  // There is already a flat config file in the root, so we should use flat config
  if (hasRootFlatConfig) {
    return true;
  }
  // Default to any v9 version if ESLint is not installed
  let eslintVersion = '9.8.0';
  try {
    const ESLint = resolveESLintClassSync();
    // Default to any v8 version in this case as it implies an older version of ESLint was found
    eslintVersion = ESLint.version || '8.0.0';
  } catch {}

  // Take ESLint's own environment variable into account when determining if we should use flat config
  const envVar = process.env.ESLINT_USE_FLAT_CONFIG;
  const useFlatConfigByDefault = gte(eslintVersion, '9.0.0');
  const useFlatConfig =
    envVar === 'true' || (envVar !== 'false' && useFlatConfigByDefault);

  return useFlatConfig;
}
