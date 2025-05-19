import type { FactoryProvider } from 'injection-js';
import { getNgPackagrVersionInfo } from './ng-packagr-version';
import { importNgPackagrPath } from './package-imports';

export function getStylesheetProcessorFactoryProvider(): FactoryProvider {
  const { major: ngPackagrMajorVersion, version: ngPackagrVersion } =
    getNgPackagrVersionInfo();

  const { STYLESHEET_PROCESSOR_TOKEN } = importNgPackagrPath<
    typeof import('ng-packagr/lib/styles/stylesheet-processor.di')
  >('ng-packagr/lib/styles/stylesheet-processor.di', ngPackagrMajorVersion);

  return {
    provide: STYLESHEET_PROCESSOR_TOKEN,
    useFactory: () => {
      if (ngPackagrMajorVersion >= 19) {
        const {
          getStylesheetProcessor,
        } = require('./v19+/stylesheet-processor');
        return getStylesheetProcessor();
      }

      if (ngPackagrVersion !== '17.2.0') {
        const {
          StylesheetProcessor,
        } = require('./pre-v19/stylesheet-processor');
        return StylesheetProcessor;
      }

      const {
        AsyncStylesheetProcessor,
      } = require('./pre-v19/stylesheet-processor');
      return AsyncStylesheetProcessor;
    },
    deps: [],
  };
}
