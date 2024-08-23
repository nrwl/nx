export { lintProjectGenerator } from './src/generators/lint-project/lint-project';
export { lintInitGenerator } from './src/generators/init/init';
export { Linter, LinterType } from './src/generators/utils/linter';

// @nx/angular needs it for the Angular CLI workspace migration to Nx to
// infer whether a config is using type aware rules and set the
// `hasTypeAwareRules` option of the `@nx/eslint:lint` executor.
export { hasRulesRequiringTypeChecking } from './src/utils/rules-requiring-type-checking';
