import type { NgPackagrBuilderOptions } from '@angular-devkit/build-angular';

export interface BuildAngularLibraryExecutorOptions
  extends NgPackagrBuilderOptions {
  project?: string;
}
