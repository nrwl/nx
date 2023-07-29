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
export { libraryGenerator } from './generators/library/library';
export { initGenerator } from './generators/init/init';

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
export {
  createLockFile,
  getLockFileName,
} from 'nx/src/plugins/js/lock-file/lock-file';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
export { createPackageJson } from 'nx/src/plugins/js/package-json/create-package-json';
