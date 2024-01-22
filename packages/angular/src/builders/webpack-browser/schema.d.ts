import { Schema } from '@angular-devkit/build-angular/src/builders/browser/schema';

export type BrowserBuilderSchema = Schema & {
  customWebpackConfig?: {
    path: string;
  };
  indexFileTransformer?: string;
  buildLibsFromSource?: boolean;
};
