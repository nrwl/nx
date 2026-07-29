// Semi-private surface for first-party Nx packages.
//
// External plugins should NOT import from here — this entry is curated for
// internal consumers and may change without semver protection. Mirrors
// `@nx/eslint/internal`.
//
// Rules are re-exported individually on purpose. The `./nx` plugin entry
// spreads `workspaceRules`, whose module-level initializer compiles the
// workspace's `tools/eslint-rules` directory; reaching a single rule through
// that entry pays for all of it.
export { default as enforceModuleBoundaries } from './src/rules/enforce-module-boundaries';
