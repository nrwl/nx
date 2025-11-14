export { lintProjectGenerator } from './generators/lint-project/lint-project.js';
export { lintInitGenerator } from './generators/init/init.js';
export { Linter, LinterType } from './generators/utils/linter.js';

// @nx/angular needs it for the Angular CLI workspace migration to Nx to
// infer whether a config is using type aware rules and set the
// `hasTypeAwareRules` option of the `@nx/eslint:lint` executor.
export { hasRulesRequiringTypeChecking } from './utils/rules-requiring-type-checking.js';
