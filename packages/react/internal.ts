// Semi-private surface for first-party Nx packages.
//
// External plugins should NOT import from here — this entry is curated for
// internal consumers and may change without semver protection. Mirrors
// `@nx/devkit/internal`.

export { addE2e } from './src/generators/application/lib/add-e2e';
export { addRollupBuildTarget } from './src/generators/library/lib/add-rollup-build-target';
export { isComponent } from './src/utils/ct-utils';
export { suppressReactComposeHelperWarnings } from './src/utils/deprecation';
export { hasWebpackPlugin } from './src/utils/has-webpack-plugin';
export {
  getReactDependenciesVersionsToInstall,
  isReact18,
} from './src/utils/version-utils';
export {
  testingLibraryDomVersion,
  testingLibraryReactVersion,
  babelCoreVersion,
  babelPresetReactVersion,
} from './src/utils/versions';
