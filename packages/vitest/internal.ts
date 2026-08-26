// Semi-private surface for first-party Nx packages.
//
// External plugins should NOT import from here — this entry is curated for
// internal consumers and may change without semver protection. Mirrors
// `@nx/devkit/internal`.

/**
 * The Oxlint plugins a Vitest-tested project needs. Declared here so the linter
 * does not have to know what a test runner requires; `@nx/js`'s
 * `addLintingToProject` reads it through `ensurePackage`.
 */
export const oxlintPlugins = ['vitest'];
export {
  createOrEditViteConfig,
  ViteConfigFileOptions,
} from './src/utils/generator-utils';
