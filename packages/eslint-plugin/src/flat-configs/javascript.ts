import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { packageExists } from '../utils/config-utils';

const isPrettierAvailable =
  packageExists('prettier') && packageExists('eslint-config-prettier');

/**
 * This configuration is intended to be applied to ALL .js and .jsx files
 * within an Nx workspace.
 *
 * It should therefore NOT contain any rules or plugins which are specific
 * to one ecosystem, such as React, Angular, Node etc.
 *
 * We use @typescript-eslint/parser rather than the built in JS parser
 * because that is what Nx ESLint configs have always done and we don't
 * want to change too much all at once.
 *
 * TODO: Evaluate switching to the built-in JS parser (espree) in Nx v11,
 * it should yield a performance improvement but could introduce subtle
 * breaking changes - we should also look to replace all the @typescript-eslint
 * related plugins and rules below.
 */
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...(isPrettierAvailable ? [require('eslint-config-prettier')] : []),
  {
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    rules: {
      '@typescript-eslint/explicit-member-accessibility': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-parameter-properties': 'off',
      /**
       * Until ESM usage in Node matures, using require in e.g. JS config files
       * is by far the more common thing to do, so disabling this to avoid users
       * having to frequently use "eslint-disable-next-line" in their configs.
       */
      '@typescript-eslint/no-var-requires': 'off',

      /**
       * From https://typescript-eslint.io/blog/announcing-typescript-eslint-v6/#updated-configuration-rules
       *
       * The following rules were added to preserve the linting rules that were
       * previously defined v5 of `@typescript-eslint`. v6 of `@typescript-eslint`
       * changed how configurations are defined.
       *
       * TODO(eslint): re-evalute these deviations from @typescript-eslint/recommended in v20 of Nx
       */
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/adjacent-overload-signatures': 'error',
      '@typescript-eslint/prefer-namespace-keyword': 'error',
      'no-empty-function': 'off',
      '@typescript-eslint/no-empty-function': 'error',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-empty-interface': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      /**
       * During the migration to use ESLint v9 and typescript-eslint v8 for new workspaces,
       * this rule would have created a lot of noise, so we are disabling it by default for now.
       *
       * TODO(eslint): we should make this part of what we re-evaluate in v20
       */
      '@typescript-eslint/no-require-imports': 'off',
    },
  }
);
