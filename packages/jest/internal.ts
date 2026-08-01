// Semi-private surface for first-party Nx packages.
//
// External plugins should NOT import from here — this entry is curated for
// internal consumers and may change without semver protection. Mirrors
// `@nx/devkit/internal`.

export { versions, getInstalledJestMajorVersion } from './src/utils/versions';

export { findRootJestPreset } from './src/utils/config/config-file';
