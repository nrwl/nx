import type { FactoryProvider } from 'injection-js';
import { getNgPackagrVersionInfo } from './ng-packagr-version';
import { importNgPackagrPath } from './package-imports';

export function getStylesheetProcessorFactoryProvider(): FactoryProvider {
  const { major: ngPackagrMajorVersion } = getNgPackagrVersionInfo();

  const { STYLESHEET_PROCESSOR_TOKEN } = importNgPackagrPath<
    typeof import('ng-packagr/src/lib/styles/stylesheet-processor.di')
  >('ng-packagr/src/lib/styles/stylesheet-processor.di', ngPackagrMajorVersion);

  return {
    provide: STYLESHEET_PROCESSOR_TOKEN,
    useFactory: () => {
      const { getStylesheetProcessor } = require('./stylesheet-processor');
      return getStylesheetProcessor();
    },
    deps: [],
  };
}
