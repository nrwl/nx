import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const nxVersion: string = require('@nx/oxlint/package.json').version;

/**
 * The inference plugin enumerates lintable files by spawning
 * `oxlint --debug=files`, which needs two things that only line up from 1.70.0:
 * the `--debug` flag itself, and a `./package.json` entry in Oxlint's `exports`
 * so `require.resolve('oxlint/package.json')` can locate the binary. Below that
 * both fail and inference silently loses ignore-awareness.
 *
 * Earlier floors this supersedes: `oxlint.config.ts` support (oxc #17563) in
 * 1.43.0, which `OXLINT_CONFIG_FILENAMES` still depends on, the JS plugin API
 * the boundaries bridge needs in 1.16.0, and `--type-aware` in 1.11.0.
 */
export const minSupportedOxlintVersion = '1.70.0';
export const oxlintVersion = '^1.75.0';
