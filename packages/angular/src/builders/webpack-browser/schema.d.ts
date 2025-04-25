import type { Schema } from '@angular-devkit/build-angular/src/builders/browser/schema';

export type BrowserBuilderSchema = Schema & {
  customWebpackConfig?: {
    path: string;
  };
  indexHtmlTransformer?: string;
  buildLibsFromSource?: boolean;
  watchDependencies?: boolean;
};
