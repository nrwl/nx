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
export default tseslint.config(
  ...angularEslint.configs.tsRecommended.map((c) => ({
    // Files need to be specified or else typescript-eslint rules will be
    // applied to non-TS files. For example, buildable/publishable libs
    // add rules to *.json files, and TS rules should not apply to them.
    // See: https://github.com/nrwl/nx/issues/28069
    files: ['**/*.ts'],
    ...c,
  })),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2015,
        ...globals.node,
      },
    },
    processor: angularEslint.processInlineTemplates,
    plugins: { '@angular-eslint': angularEslint.tsPlugin },
  }
);
