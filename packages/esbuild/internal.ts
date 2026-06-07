// Semi-private surface for first-party Nx packages.
//
// External plugins should NOT import from here — this entry is curated for
// internal consumers and may change without semver protection. Mirrors
// `@nx/devkit/internal`.

export { assertSupportedEsbuildVersion } from './src/utils/assert-supported-esbuild-version';
export { getClientEnvironment } from './src/utils/environment-variables';
export {
  getEntryPoints,
  type GetEntryPointsOptions,
} from './src/utils/get-entry-points';
export {
  nxVersion,
  tsLibVersion,
  minSupportedEsbuildVersion,
} from './src/utils/versions';
