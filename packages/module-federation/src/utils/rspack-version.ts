import type { Compiler } from '@rspack/core';

/**
 * Returns the major version of the `@rspack/core` runtime backing the given
 * compiler, read from the compiler's `rspack` namespace so no value import of
 * the (pure-ESM) `@rspack/core` package is needed.
 */
export function getRspackMajorVersion(compiler: Compiler): number {
  return parseInt(compiler.rspack.rspackVersion ?? '1', 10);
}

/** True when the compiler is running `@rspack/core` v2 or newer. */
export function isRspackV2(compiler: Compiler): boolean {
  return getRspackMajorVersion(compiler) >= 2;
}
