/**
 * This configuration is intended to be applied to ALL .ts files in Angular
 * projects within an Nx workspace.
 *
 * It should therefore NOT contain any rules or plugins which are related to
 * Angular Templates, or more cross-cutting concerns which are not specific
 * to Angular.
 *
 * This configuration is intended to be combined with other configs from this
 * package.
 */
export default {
  plugins: ['@angular-eslint'],
  extends: ['plugin:@angular-eslint/recommended'],
  /**
   * Apply our thin wrapper around @typescript-eslint/parser
   * NOTE: For the relative path to work it needs to be relative to eslint-plugin-nx/src/index.js
   */
  parser: './parser.js',
  rules: {},
};
