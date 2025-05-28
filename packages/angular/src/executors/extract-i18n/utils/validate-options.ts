import { lt } from 'semver';
import { getInstalledAngularVersionInfo } from '../../utilities/angular-version-utils';
import type { ExtractI18nExecutorOptions } from '../schema';

export function validateOptions(options: ExtractI18nExecutorOptions): void {
  const { version: angularVersion } = getInstalledAngularVersionInfo();

  if (lt(angularVersion, '20.0.0')) {
    if (options.i18nDuplicateTranslation) {
      throw new Error(
        `The "i18nDuplicateTranslation" option requires Angular version 20.0.0 or greater. You are currently using version ${angularVersion}.`
      );
    }
  }
}
