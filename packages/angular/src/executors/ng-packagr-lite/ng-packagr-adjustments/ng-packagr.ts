import { type NgPackagr, ngPackagr } from 'ng-packagr';

export async function getNgPackagrInstance(): Promise<NgPackagr> {
  const { getWriteBundlesTransformProvider } = await import(
    './ng-package/entry-point/write-bundles.di.js'
  );
  const { getStylesheetProcessorFactoryProvider } = await import(
    '../../utilities/ng-packagr/stylesheet-processor.di.js'
  );

  const packagr = ngPackagr();
  packagr.withProviders([
    getWriteBundlesTransformProvider(),
    getStylesheetProcessorFactoryProvider(),
  ]);

  return packagr;
}
