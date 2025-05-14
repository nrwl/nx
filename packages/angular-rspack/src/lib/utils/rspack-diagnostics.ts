import type { Compilation, RspackError } from '@rspack/core';

export function addError(
  compilation: Compilation,
  messageOrError: RspackError | string
): void {
  const error = new compilation.compiler.rspack.WebpackError(
    typeof messageOrError === 'string' ? messageOrError : messageOrError.message
  );
  if (typeof messageOrError !== 'string') {
    if (messageOrError.hideStack) {
      (error as RspackError).hideStack = true;
    }
  }
  compilation.errors.push(error);
}

export function addWarning(
  compilation: Compilation,
  messageOrError: RspackError | string
): void {
  const warning = new compilation.compiler.rspack.WebpackError(
    typeof messageOrError === 'string' ? messageOrError : messageOrError.message
  );
  if (typeof messageOrError !== 'string') {
    if (messageOrError.hideStack) {
      (warning as RspackError).hideStack = true;
    }
  }
  compilation.warnings.push(warning);
}
