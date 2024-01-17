import type { ApplicationBuilderOptions } from '@angular-devkit/build-angular';
import type { PluginSpec } from '../utilities/esbuild-extensions';

export interface ApplicationExecutorOptions extends ApplicationBuilderOptions {
  buildLibsFromSource?: boolean;
  indexHtmlTransformer?: string;
  plugins?: string[] | PluginSpec[];
}
