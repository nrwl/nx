import type { Compiler } from '@rspack/core';

// Read from compiler.rspack to avoid a value import of the (pure-ESM) v2 package.
export function getRspackMajorVersion(compiler: Compiler): number {
  return parseInt(compiler.rspack.rspackVersion ?? '1', 10);
}

export function isRspackV2(compiler: Compiler): boolean {
  return getRspackMajorVersion(compiler) >= 2;
}
