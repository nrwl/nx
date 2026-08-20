export * from './utils/typescript/add-tslib-dependencies';
export * from './utils/typescript/load-ts-transformers';
export * from './utils/typescript/print-diagnostics';
export * from './utils/typescript/run-type-check';
export * from './utils/typescript/get-source-nodes';
export * from './utils/compiler-helper-dependency';
export * from './utils/typescript/ts-config';
export * from './utils/typescript/create-ts-config';
export * from './utils/typescript/ast-utils';
export * from './utils/package-json';
export * from './utils/assets';
export * from './utils/package-json/update-package-json';
export * from './utils/package-json/create-entry-points';
export { libraryGenerator } from './generators/library/library';
export { initGenerator } from './generators/init/init';
export { setupPrettierGenerator } from './generators/setup-prettier/generator';
export { setupVerdaccio } from './generators/setup-verdaccio/generator';
export { isValidVariable } from './utils/is-valid-variable';
// `detectLinters` and `addLintingToProject` are deliberately not here — they are
// first-party generator plumbing and live in `@nx/js/internal`. Only the type is
// public, because `@nx/eslint` re-exports it and generator `schema.d.ts` files
// import it.
export { type LinterType } from './utils/linter';

export {
  createLockFile,
  createPackageJson,
  generatePrunedDeployOutput,
  getLockFileName,
} from '@nx/devkit/internal';
