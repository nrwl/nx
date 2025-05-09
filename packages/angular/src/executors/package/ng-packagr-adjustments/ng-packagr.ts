import { type NgPackagr, ngPackagr } from 'ng-packagr';

export async function getNgPackagrInstance(): Promise<NgPackagr> {
  const { getStylesheetProcessorFactoryProvider } = await import(
    '../../utilities/ng-packagr/stylesheet-processor.di.js'
  );

  const packagr = ngPackagr();
  packagr.withProviders([getStylesheetProcessorFactoryProvider()]);
  return packagr;
}
