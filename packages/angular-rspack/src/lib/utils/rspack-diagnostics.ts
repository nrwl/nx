import type { Compilation } from '@rspack/core';

export function addError(compilation: Compilation, message: string): void {
  compilation.errors.push(
    new compilation.compiler.rspack.WebpackError(message)
  );
}

export function addWarning(compilation: Compilation, message: string): void {
  compilation.warnings.push(
    new compilation.compiler.rspack.WebpackError(message)
  );
}
