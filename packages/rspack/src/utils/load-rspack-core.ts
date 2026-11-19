import type { Compiler } from '@rspack/core';

// @rspack/core v2 is pure ESM; lazy-require avoids resolving it before a Compiler exists.
export function loadRspackCore(
  compiler?: Pick<Compiler, 'rspack'>
): typeof import('@rspack/core') {
  // Reuse the compiler's already-resolved module to avoid ending up with a second, possibly different copy.
  return compiler
    ? (compiler.rspack as unknown as typeof import('@rspack/core'))
    : require('@rspack/core');
}
