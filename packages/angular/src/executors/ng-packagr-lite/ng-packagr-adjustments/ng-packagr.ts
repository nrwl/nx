import { NgPackagr, ngPackagr } from 'ng-packagr';

export async function getNgPackagrInstance(): Promise<NgPackagr> {
  const { WRITE_BUNDLES_TRANSFORM } = await import(
    './ng-package/entry-point/write-bundles.di.js'
  );
  const { STYLESHEET_PROCESSOR } = await import(
    '../../utilities/ng-packagr/stylesheet-processor.di.js'
  );

  const packagr = ngPackagr();
  packagr.withProviders([WRITE_BUNDLES_TRANSFORM, STYLESHEET_PROCESSOR]);

  return packagr;
}
