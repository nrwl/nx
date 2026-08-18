// Semi-private surface for first-party Nx packages.
//
// External plugins should NOT import from here — this entry is curated for
// internal consumers and may change without semver protection. Mirrors
// `@nx/devkit/internal`.
//
// These mirror the previously-public `@nx/angular/src/utils`,
// `@nx/angular/src/generators/utils` and `@nx/angular/src/generators/move/move-impl`
// subpaths (removed from the exports map in 23.0.0). The
// `rewrite-internal-subpath-imports` migration routes consumers of those
// subpaths here, so every symbol they exposed must be re-exported.

export * from './src/utils';
export * from './src/generators/utils';
export { move } from './src/generators/move/move-impl';
