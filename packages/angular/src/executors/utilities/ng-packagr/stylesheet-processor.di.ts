import type { FactoryProvider } from 'injection-js';
import { STYLESHEET_PROCESSOR_TOKEN } from 'ng-packagr/lib/styles/stylesheet-processor.di';
import { gte, lt } from 'semver';
import { getInstalledPackageVersionInfo } from '../angular-version-utils';
import {
  AsyncStylesheetProcessor,
  StylesheetProcessor,
} from './stylesheet-processor';

export const STYLESHEET_PROCESSOR: FactoryProvider = {
  provide: STYLESHEET_PROCESSOR_TOKEN,
  useFactory: () => {
    const { version: ngPackagrVersion } =
      getInstalledPackageVersionInfo('ng-packagr');

    return lt(ngPackagrVersion, '17.2.0') || gte(ngPackagrVersion, '17.3.0')
      ? StylesheetProcessor
      : AsyncStylesheetProcessor;
  },
  deps: [],
};
