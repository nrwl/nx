import eslint from '@eslint/js';
import { workspaceRoot } from '@nx/devkit';
import tseslint, { type ConfigArray } from 'typescript-eslint';
import { packageExists } from '../utils/config-utils';

const isPrettierAvailable =
  packageExists('prettier') && packageExists('eslint-config-prettier');

/**
 * This configuration is intended to be applied to ALL .ts and .tsx files
 * within an Nx workspace.
 *
 * It should therefore NOT contain any rules or plugins which are specific
 * to one ecosystem, such as React, Angular, Node etc.
 */
const config: ConfigArray = tseslint.config(
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: {
        tsconfigRootDir: workspaceRoot,
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'],
    rules: {
      /**
       * From https://typescript-eslint.io/blog/announcing-typescript-eslint-v6/#updated-configuration-rules
       *
       * The following rules were added to preserve the linting rules that were
       * previously defined v5 of `@typescript-eslint`. v6 of `@typescript-eslint`
       * changed how configurations are defined.
       */
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/adjacent-overload-signatures': 'error',
      'no-empty-function': 'off',
      '@typescript-eslint/no-empty-function': 'error',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-empty-interface': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      /**
       * During the migration to use ESLint v9 and typescript-eslint v8 for new workspaces,
       * this rule would have created a lot of noise, so we are disabling it by default for now.
       */
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  /**
   * We include it last so it overrides the conflicting rules from the configuration blocks above.
   */
  ...(isPrettierAvailable ? [require('eslint-config-prettier')] : [])
);

export default config;
