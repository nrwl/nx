import { lt } from 'semver';
import { getInstalledAngularVersionInfo } from '../../utilities/angular-version-utils';
import type { ApplicationExecutorOptions } from '../schema';

export function validateOptions(options: ApplicationExecutorOptions): void {
  const { version: angularVersion } = getInstalledAngularVersionInfo();

  if (lt(angularVersion, '20.0.0')) {
    if (
      options.sourceMap &&
      typeof options.sourceMap === 'object' &&
      options.sourceMap.sourcesContent === false
    ) {
      throw new Error(
        `The "sourceMap.sourcesContent" option requires Angular version 20.0.0 or greater. You are currently using version ${angularVersion}.`
      );
    }

    if (options.conditions) {
      throw new Error(
        `The "conditions" option requires Angular version 20.0.0 or greater. You are currently using version ${angularVersion}.`
      );
    }
  }

  if (lt(angularVersion, '20.1.0')) {
    if (options.loader) {
      const invalidLoaders = Array.from(
        new Set(
          Object.values(options.loader).filter(
            (l) => l === 'dataurl' || l === 'base64'
          )
        )
      );

      if (invalidLoaders.length) {
        throw new Error(
          `Using the ${invalidLoaders
            .map((l) => `"${l}"`)
            .join(' and ')} loader${
            invalidLoaders.length > 1 ? 's' : ''
          } requires Angular version 20.1.0 or greater. You are currently using version ${angularVersion}.`
        );
      }
    }
  }
}
