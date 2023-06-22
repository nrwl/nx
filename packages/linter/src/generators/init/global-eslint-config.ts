import { Linter as LinterType } from 'eslint';

/**
 * This configuration is intended to apply to all TypeScript source files.
 * See the eslint-plugin package for what is in the referenced shareable config.
 */
export const globalTypeScriptOverrides = {
  files: ['*.ts', '*.tsx'],
  extends: ['plugin:@nx/typescript'],
  /**
   * Having an empty rules object present makes it more obvious to the user where they would
   * extend things from if they needed to
   */
  rules: {},
};

/**
 * This configuration is intended to apply to all JavaScript source files.
 * See the eslint-plugin package for what is in the referenced shareable config.
 */
export const globalJavaScriptOverrides = {
  files: ['*.js', '*.jsx'],
  extends: ['plugin:@nx/javascript'],
  /**
   * Having an empty rules object present makes it more obvious to the user where they would
   * extend things from if they needed to
   */
  rules: {},
};

/**
 * This configuration is intended to apply to all JSON source files.
 * See the eslint-plugin package for what is in the referenced shareable config.
 */
export const globalJsonOverrides = {
  files: ['*.json'],
  parser: 'jsonc-eslint-parser',
  /**
   * Having an empty rules object present makes it more obvious to the user where they would
   * extend things from if they needed to
   */
  rules: {},
};

/**
 * This configuration is intended to apply to all "source code" (but not
 * markup like HTML, or other custom file types like GraphQL)
 */
export const moduleBoundariesOverride = {
  files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
  rules: {
    '@nx/enforce-module-boundaries': [
      'error',
      {
        enforceBuildableLibDependency: true,
        allow: [],
        depConstraints: [{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }],
      },
    ],
  } as LinterType.RulesRecord,
};

export const getGlobalEsLintConfiguration = (
  unitTestRunner?: string,
  rootProject?: boolean
) => {
  const config: LinterType.Config = {
    root: true,
    ignorePatterns: rootProject ? ['!**/*'] : ['**/*'],
    plugins: ['@nx'],
    /**
     * We leverage ESLint's "overrides" capability so that we can set up a root config which will support
     * all permutations of Nx workspaces across all frameworks, libraries and tools.
     *
     * The key point is that we need entirely different ESLint config to apply to different types of files,
     * but we still want to share common config where possible.
     */
    overrides: [
      ...(rootProject ? [] : [moduleBoundariesOverride]),
      globalTypeScriptOverrides,
      globalJavaScriptOverrides,
    ],
  };
  if (unitTestRunner === 'jest') {
    config.overrides.push({
      files: ['*.spec.ts', '*.spec.tsx', '*.spec.js', '*.spec.jsx'],
      env: {
        jest: true,
      },
      rules: {},
    });
  }
  return config;
};
