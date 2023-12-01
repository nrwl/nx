import type { Schema } from '@angular-devkit/build-angular/src/builders/browser-esbuild/schema';
import type { PluginSpec } from '../utilities/esbuild-extensions';

export interface EsBuildSchema extends Schema {
  buildLibsFromSource?: boolean;
  plugins?: string[] | PluginSpec[];
}
