import type { ExtractI18nBuilderOptions } from '@angular-devkit/build-angular';

export type ExtractI18nExecutorOptions = Omit<
  ExtractI18nBuilderOptions,
  'browserTarget'
> & {
  buildTarget: string;
};
