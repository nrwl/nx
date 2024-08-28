import angularEslint from 'angular-eslint';
import globals from 'globals';
import tseslint from 'typescript-eslint';

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
export default tseslint.config(...angularEslint.configs.tsRecommended, {
  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.es2015,
      ...globals.node,
    },
  },
  plugins: { '@angular-eslint': angularEslint.tsPlugin },
  rules: {},
});
