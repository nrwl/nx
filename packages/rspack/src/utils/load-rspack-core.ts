import type { Compiler } from '@rspack/core';

/**
 * Resolves the `@rspack/core` module without ever `require`-ing it at
 * module parse time.
 *
 * `@rspack/core@2` ships as a pure-ESM entry point (the bundle itself is
 * CJS-shaped internally, but `package.json` declares `"type": "module"`
 * with no `require` export condition). A top-level
 * `import { rspack } from '@rspack/core'` (or an equivalent
 * `require('@rspack/core')` sitting outside a function body) forces Node
 * to resolve that ESM module the moment the *containing file* is loaded —
 * which happens as soon as anything requires the executor, long before any
 * config or compiler exists. That eager resolution is exactly what bit
 * https://github.com/nrwl/nx/pull/35682 was trying to avoid (see the
 * "Lazy-require" comments in `apply-base-config.ts` / `apply-web-config.ts`),
 * but it only patched those two call sites — `create-compiler.ts` still had
 * a top-level value import, so loading `@nx/rspack:rspack` (or
 * `@nx/rspack:dev-server`, which imports `createCompiler`) still triggers
 * the eager resolution unconditionally.
 *
 * All call sites should resolve `@rspack/core` through this helper instead
 * of requiring it directly, so there is exactly one lazy, consistent
 * resolution path:
 * - When a `Compiler` instance is already available (e.g. inside a
 *   plugin's `apply(compiler)`), reuse `compiler.rspack` — the module
 *   instance rspack itself resolved to construct that compiler — instead of
 *   asking Node to resolve `@rspack/core` a second time. This avoids ending
 *   up with two different resolved copies of `@rspack/core` (and mismatched
 *   `instanceof` checks / duplicate native bindings) when a workspace's
 *   `node_modules` layout contains more than one copy, which npm's hoisting
 *   is more prone to producing than yarn/pnpm.
 * - Otherwise, `require()` it lazily, inside the function body that needs
 *   it, so the resolution only happens when a build actually runs (and stays
 *   lazy even after this file is loaded eagerly, e.g. by Jest or by bundling
 *   nx's own dist output).
 */
export function loadRspackCore(
  compiler?: Pick<Compiler, 'rspack'>
): typeof import('@rspack/core') {
  return compiler
    ? (compiler.rspack as unknown as typeof import('@rspack/core'))
    : require('@rspack/core');
}
