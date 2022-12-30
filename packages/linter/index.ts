export { lintProjectGenerator } from './src/generators/lint-project/lint-project';
export { lintInitGenerator } from './src/generators/init/init';
export { Linter } from './src/generators/utils/linter';
export * from './src/utils/convert-tslint-to-eslint';

// @nrwl/angular needs it for the Angular CLI workspace migration to Nx to
// infer whether a config is using type aware rules and set the
// `hasTypeAwareRules` option of the `@nrwl/linter:eslint` executor.
export { hasRulesRequiringTypeChecking } from './src/utils/rules-requiring-type-checking';
