import type { Schema } from '@angular-devkit/build-angular/src/builders/browser/schema';

export type BrowserBuilderSchema = Schema & {
  customWebpackConfig?: {
    path: string;
  };
  indexHtmlTransformer?: string;
  buildLibsFromSource?: boolean;
  watchDependencies?: boolean;

  /**
   * @deprecated Use `indexHtmlTransformer` instead. It will be removed in Nx 21.
   */
  indexFileTransformer?: string;
};
