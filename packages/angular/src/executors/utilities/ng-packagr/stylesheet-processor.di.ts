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
      if (ngPackagrMajorVersion >= 19) {
        const {
          getStylesheetProcessor,
        } = require('./v19+/stylesheet-processor');
        return getStylesheetProcessor();
      }

      const { StylesheetProcessor } = require('./pre-v19/stylesheet-processor');
      return StylesheetProcessor;
    },
    deps: [],
  };
}
