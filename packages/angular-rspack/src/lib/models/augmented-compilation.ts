import type { Compilation } from '@rspack/core';
import type { JavaScriptTransformer } from '@nx/angular-rspack-compiler';

export const NG_RSPACK_SYMBOL_NAME = 'NG_RSPACK_BUILD';

export type NG_RSPACK_COMPILATION_STATE = {
  javascriptTransformer: JavaScriptTransformer;
  typescriptFileCache: Map<string, string | Buffer>;
};
export type NgRspackCompilation = Compilation & {
  [NG_RSPACK_SYMBOL_NAME]: () => NG_RSPACK_COMPILATION_STATE;
};
