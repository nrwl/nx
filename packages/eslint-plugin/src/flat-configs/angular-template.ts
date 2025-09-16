import angular from 'angular-eslint';
import tseslint, { type ConfigArray } from 'typescript-eslint';

/**
 * This configuration is intended to be applied to ALL .html files in Angular
 * projects within an Nx workspace, as well as extracted inline templates from
 * .component.ts files (or similar).
 *
 * It should therefore NOT contain any rules or plugins which are related to
 * Angular source code.
 *
 * NOTE: The processor to extract the inline templates is applied in users'
 * configs by the relevant schematic.
 *
 * This configuration is intended to be combined with other configs from this
 * package.
 */
const config: ConfigArray = tseslint.config({
  files: ['**/*.html'],
  extends: [
    ...angular.configs.templateRecommended,
    ...angular.configs.templateAccessibility,
  ],
  rules: {},
});

export default config;
