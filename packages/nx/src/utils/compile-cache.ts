import * as nodeModule from 'node:module';

type EnableCompileCacheFn = (dir?: string) => unknown;

/**
 * Enables V8's on-disk bytecode cache for the current process.
 *
 * Calls `module.enableCompileCache()` with no arguments and lets Node pick
 * the location, which means Node's standard env vars work transparently:
 *  - `NODE_COMPILE_CACHE=<dir>`     — override the cache directory.
 *  - `NODE_DISABLE_COMPILE_CACHE=1` — disable entirely.
 *
 * The default location lives under the OS temp dir keyed by V8 version, so
 * the cache is shared across workspaces and self-invalidates on Node
 * upgrades — no nx-specific cleanup needed.
 *
 * Called at the entry point of every long-lived nx process (main CLI,
 * daemon, plugin workers) via `enable-compile-cache.ts`, which side-effects
 * this on import.
 *
 * Set `NX_COMPILE_CACHE=false` to opt out without disabling the cache for
 * non-nx Node processes the way `NODE_DISABLE_COMPILE_CACHE` would.
 *
 * No-op on Node versions without the `module.enableCompileCache` API.
 * Errors are swallowed — the compile cache is a pure performance
 * optimization and must never break the CLI.
 */
export function enableCompileCache(
  // Test seam: production callers omit this. `unknown` (rather than
  // `EnableCompileCacheFn | undefined`) lets tests pass a non-function to
  // simulate pre-22.8 Node where `module.enableCompileCache` is missing. We
  // read `arguments.length` so callers can *explicitly* pass `undefined`.
  ...override: [unknown?]
): boolean {
  if (process.env.NX_COMPILE_CACHE === 'false') return false;
  const impl: unknown =
    override.length === 0
      ? (
          nodeModule as unknown as {
            enableCompileCache?: EnableCompileCacheFn;
          }
        ).enableCompileCache
      : override[0];
  if (typeof impl !== 'function') return false;
  try {
    (impl as EnableCompileCacheFn)();
    return true;
  } catch {
    return false;
  }
}
