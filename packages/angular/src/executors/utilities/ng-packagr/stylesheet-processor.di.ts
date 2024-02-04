import { FactoryProvider } from 'injection-js';
import { STYLESHEET_PROCESSOR_TOKEN } from 'ng-packagr/lib/styles/stylesheet-processor.di';
import { StylesheetProcessor } from './stylesheet-processor';

export const STYLESHEET_PROCESSOR: FactoryProvider = {
  provide: STYLESHEET_PROCESSOR_TOKEN,
  useFactory: () => StylesheetProcessor,
  deps: [],
};
