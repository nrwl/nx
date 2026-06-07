// Semi-private surface for first-party Nx packages.
//
// External plugins should NOT import from here — this entry is curated for
// internal consumers and may change without semver protection. Mirrors
// `@nx/devkit/internal`.

export { angularDevkitVersion } from './src/utils';
export { move } from './src/generators/move/move-impl';
