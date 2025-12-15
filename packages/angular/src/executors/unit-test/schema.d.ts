import type { UnitTestBuilderOptions } from '@angular/build';
import type { PluginSpec } from '../utilities/esbuild-extensions';

export interface UnitTestExecutorOptions extends UnitTestBuilderOptions {
  indexHtmlTransformer?: string;
  plugins?: string[] | PluginSpec[];
}
