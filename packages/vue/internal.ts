// Semi-private surface for first-party Nx packages.
//
// External plugins should NOT import from here — this entry is curated for
// internal consumers and may change without semver protection. Mirrors
// `@nx/devkit/internal`.

export { assertSupportedVueVersion } from './src/utils/assert-supported-vue-version';
export { createTsConfig } from './src/utils/create-ts-config';
export { ensureDependencies } from './src/utils/ensure-dependencies';
export { hasRsbuildPlugin } from './src/utils/has-rsbuild-plugin';
