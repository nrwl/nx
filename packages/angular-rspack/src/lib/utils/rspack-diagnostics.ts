import type { Compilation } from '@rspack/core';

// `RspackError` is not publicly exported from `@rspack/core` until v1.4.0,
// but the supported peer range starts at v1.3.5. Derive the type from the
// publicly-exported `Compilation` class, which exposes it via `errors[]`.
type RspackError = Compilation['errors'][number];

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
