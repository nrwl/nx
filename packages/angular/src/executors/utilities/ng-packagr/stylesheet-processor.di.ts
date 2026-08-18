import type { FactoryProvider } from 'injection-js';
import { STYLESHEET_PROCESSOR_TOKEN } from 'ng-packagr/src/lib/styles/stylesheet-processor.di';

export function getStylesheetProcessorFactoryProvider(): FactoryProvider {
  return {
    provide: STYLESHEET_PROCESSOR_TOKEN,
    useFactory: () => {
      const { getStylesheetProcessor } = require('./stylesheet-processor');
      return getStylesheetProcessor();
    },
    deps: [],
  };
}
