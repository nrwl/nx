import type { Compilation } from '@rspack/core';
import type {
  JavaScriptTransformer,
  SourceFileCache,
} from '@nx/angular-rspack-compiler';
import { I18nOptions } from './i18n';

export const NG_RSPACK_SYMBOL_NAME = 'NG_RSPACK_BUILD';

export type NG_RSPACK_COMPILATION_STATE = {
  javascriptTransformer: JavaScriptTransformer;
  typescriptFileCache: SourceFileCache['typeScriptFileCache'];
  // Mirrors @angular/build: false means Angular emitted transformed
  // TypeScript and the bundler transpiles it (fast path).
  useTypeScriptTranspilation: boolean;
  // True when the Angular compilation failed to initialize or emit, meaning
  // the typescript file cache cannot be relied on for this build.
  angularCompilationFailed: boolean;
  // Metafile inputs of the bundled component stylesheets, for license
  // extraction (workspace-relative paths).
  stylesheetMetafileInputs: Record<string, { bytesInOutput: number }>;
  i18n?: I18nOptions;
};
export type NgRspackCompilation = Compilation & {
  [NG_RSPACK_SYMBOL_NAME]: () => NG_RSPACK_COMPILATION_STATE;
};
