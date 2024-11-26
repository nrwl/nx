import type { Schema } from '@angular-devkit/build-angular/src/builders/browser/schema';

export type BrowserBuilderSchema = Schema & {
  customWebpackConfig?: {
    path: string;
  };
  indexHtmlTransformer?: string;
  buildLibsFromSource?: boolean;
  /**
   * @deprecated Use `indexHtmlTransformer` instead. It will be removed in Nx 20.
   */
  indexFileTransformer?: string;
};
