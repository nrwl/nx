import { Schema } from '@angular-devkit/build-angular/src/builders/browser-esbuild/schema';

export interface EsBuildSchema extends Schema {
  buildLibsFromSource?: boolean;
}
