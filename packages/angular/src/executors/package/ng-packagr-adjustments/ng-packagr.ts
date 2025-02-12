import { NgPackagr, ngPackagr } from 'ng-packagr';

export async function getNgPackagrInstance(): Promise<NgPackagr> {
  const { STYLESHEET_PROCESSOR } = await import(
    '../../utilities/ng-packagr/stylesheet-processor.di.js'
  );

  const packagr = ngPackagr();
  packagr.withProviders([STYLESHEET_PROCESSOR]);
  return packagr;
}
