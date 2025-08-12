import type { ApplicationBuilderOptions } from '@angular/build';
import type { PluginSpec } from '../utilities/esbuild-extensions';

export interface ApplicationExecutorOptions extends ApplicationBuilderOptions {
  buildLibsFromSource?: boolean;
  indexHtmlTransformer?: string;
  plugins?: string[] | PluginSpec[];
}
