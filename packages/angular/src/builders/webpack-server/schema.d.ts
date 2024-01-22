import type { ServerBuilderOptions } from '@angular-devkit/build-angular';

export interface Schema extends ServerBuilderOptions {
  customWebpackConfig?: {
    path: string;
  };
  buildLibsFromSource?: boolean;
}
