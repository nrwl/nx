import type { FactoryProvider } from 'injection-js';
import { STYLESHEET_PROCESSOR_TOKEN } from 'ng-packagr/lib/styles/stylesheet-processor.di';
import { getInstalledPackageVersionInfo } from '../angular-version-utils';

export const STYLESHEET_PROCESSOR: FactoryProvider = {
  provide: STYLESHEET_PROCESSOR_TOKEN,
  useFactory: () => {
    const { major: ngPackagrMajorVersion, version: ngPackagrVersion } =
      getInstalledPackageVersionInfo('ng-packagr');

    if (ngPackagrMajorVersion >= 19) {
      const { StylesheetProcessor } = require('./v19+/stylesheet-processor');
      return StylesheetProcessor;
    }

    if (ngPackagrVersion !== '17.2.0') {
      const { StylesheetProcessor } = require('./pre-v19/stylesheet-processor');
      return StylesheetProcessor;
    }

    const {
      AsyncStylesheetProcessor,
    } = require('./pre-v19/stylesheet-processor');
    return AsyncStylesheetProcessor;
  },
  deps: [],
};
