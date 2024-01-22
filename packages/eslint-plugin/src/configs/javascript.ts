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
 *
 * TODO: Reevaluate stylistic plugin and added specific rules in the next major
 * version of Nx. Related to https://github.com/nrwl/nx/pull/21066
 */
export default {
  env: {
    browser: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    /**
     * This was added to preserve the linting rules that were previously
     * defined v5 of @typescript-eslint. v6 of @typescript-eslint changed
     * how configurations are defined. This should be reevaluated in the
     * next major version of Nx.
     */
    'plugin:@typescript-eslint/stylistic',
    ...(isPrettierAvailable ? ['prettier'] : []),
  ],
  rules: {
    '@typescript-eslint/explicit-member-accessibility': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    /**
     * These 3 rules:
     *   `no-extra-semi`
     *   `@typescript-eslint/no-extra-semi`
     *   `@typescript-eslint/no-non-null-assertion`
     * were added to preserve the linting rules that were
     * previously defined v5 of `@typescript-eslint`. v6 of `@typescript-eslint`
     * changed how configurations are defined. This should be reevaluated in
     * the next major version of Nx.
     */
    'no-extra-semi': 'off',
    '@typescript-eslint/no-extra-semi': 'error',
    '@typescript-eslint/no-non-null-assertion': 'warn',

    '@typescript-eslint/no-parameter-properties': 'off',
    /**
     * Until ESM usage in Node matures, using require in e.g. JS config files
     * is by far the more common thing to do, so disabling this to avoid users
     * having to frequently use "eslint-disable-next-line" in their configs.
     */
    '@typescript-eslint/no-var-requires': 'off',
  },
};
