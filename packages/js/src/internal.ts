export { resolveModuleByImport } from './utils/typescript/ast-utils';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
export {
  registerTsProject,
  registerTsConfigPaths,
} from 'nx/src/plugins/js/utils/register';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
export { TargetProjectLocator } from 'nx/src/plugins/js/project-graph/build-dependencies/target-project-locator';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
export { findProjectsNpmDependencies } from 'nx/src/plugins/js/package-json/create-package-json';
