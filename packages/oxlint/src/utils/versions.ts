import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const nxVersion: string = require('@nx/oxlint/package.json').version;

/**
 * `oxlint.config.ts` support (oxc #17563), which landed in 1.43.0. That is the
 * highest floor of anything this package recognizes unconditionally — the JS
 * plugin API the boundaries bridge needs arrived in 1.16.0 and `--type-aware`
 * in 1.11.0 — and `OXLINT_CONFIG_FILENAMES` lists the TypeScript configs, so a
 * workspace below this would get a target inferred from a config its Oxlint
 * cannot read.
 */
export const minSupportedOxlintVersion = '1.43.0';
export const oxlintVersion = '^1.75.0';
