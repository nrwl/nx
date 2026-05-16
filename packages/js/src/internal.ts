/**
 * @deprecated Backwards-compatibility shim for `@nx/js/src/internal`.
 *
 * The `./src/internal` subpath was removed in nx 23 — the canonical path is
 * now `@nx/js/internal`.  Additionally, `getRootTsConfigPath` moved to the
 * main `@nx/js` entry.
 *
 * This shim keeps `@nx/conformance@4` / `@nx/conformance@5.0.x` working on
 * nx 23.  Both packages do:
 *   `const { getRootTsConfigPath } = await import('@nx/js/src/internal')`
 *   `const { registerTsProject }   = await import('@nx/js/src/internal')`
 *
 * Do NOT add new exports here.  Consumers should migrate to:
 *   - `@nx/js/internal`   for `registerTsProject` (and other internal helpers)
 *   - `@nx/js`            for `getRootTsConfigPath`
 */

// registerTsProject lives in the new ./internal entry
export { registerTsProject } from '../internal';

// getRootTsConfigPath moved to the main @nx/js entry in nx 23
export { getRootTsConfigPath } from './utils/typescript/ts-config';
