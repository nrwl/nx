export * from './utils/typescript/add-tslib-dependencies.js';
export * from './utils/typescript/load-ts-transformers.js';
export * from './utils/typescript/print-diagnostics.js';
export * from './utils/typescript/run-type-check.js';
export * from './utils/typescript/get-source-nodes.js';
export * from './utils/compiler-helper-dependency.js';
export * from './utils/typescript/ts-config.js';
export * from './utils/typescript/create-ts-config.js';
export * from './utils/typescript/ast-utils.js';
export * from './utils/package-json/index.js';
export * from './utils/assets/index.js';
export * from './utils/package-json/update-package-json.js';
export * from './utils/package-json/create-entry-points.js';
export { libraryGenerator } from './generators/library/library.js';
export { initGenerator } from './generators/init/init.js';
export { setupPrettierGenerator } from './generators/setup-prettier/generator.js';
export { setupVerdaccio } from './generators/setup-verdaccio/generator.js';
export { isValidVariable } from './utils/is-valid-variable.js';

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
export {
  createLockFile,
  getLockFileName,
} from 'nx/src/plugins/js/lock-file/lock-file';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
export { createPackageJson } from 'nx/src/plugins/js/package-json/create-package-json';
