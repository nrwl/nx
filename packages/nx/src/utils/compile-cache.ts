import * as nodeModule from 'node:module';
import { dirname, join } from 'node:path';
import { NX_USER_TMP_DIR } from './nx-tmp-dir';
import {
  ensureOwnedPrivateDir,
  ensureSafeSharedRoot,
} from './owned-private-dir';

type EnableCompileCacheFn = (dir?: string) => unknown;

const COMPILE_CACHE_DIR = join(NX_USER_TMP_DIR, 'compile-cache');

/**
 * Enables V8's on-disk bytecode cache for the current process.
 *
 * The cache lives in the current user's owner-only Nx tmp directory, because
 * Node's default location is a shared `os.tmpdir()` path whose contents are
 * loaded regardless of who created them. If that directory cannot be
 * established securely, the cache stays off. Node's env vars still apply:
 *  - `NODE_COMPILE_CACHE=<dir>`     — the user's chosen directory wins.
 *  - `NODE_DISABLE_COMPILE_CACHE=1` — disable entirely.
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
  // Test seams: production callers omit both. A non-function `impl` simulates
  // pre-22.8 Node, where `module.enableCompileCache` is missing.
  impl: unknown = (
    nodeModule as unknown as { enableCompileCache?: EnableCompileCacheFn }
  ).enableCompileCache,
  cacheDir: string = COMPILE_CACHE_DIR
): boolean {
  if (process.env.NX_COMPILE_CACHE === 'false') return false;
  if (typeof impl !== 'function') return false;
  try {
    if (process.env.NODE_COMPILE_CACHE) {
      (impl as EnableCompileCacheFn)();
      return true;
    }
    const userRoot = dirname(cacheDir);
    if (
      ensureSafeSharedRoot(dirname(userRoot)).status !== 'ok' ||
      ensureOwnedPrivateDir(userRoot).status !== 'ok' ||
      ensureOwnedPrivateDir(cacheDir).status !== 'ok'
    ) {
      return false;
    }
    (impl as EnableCompileCacheFn)(cacheDir);
    return true;
  } catch {
    return false;
  }
}
