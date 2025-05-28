import { lt } from 'semver';
import { getInstalledAngularVersionInfo } from '../../utilities/angular-version-utils';
import type { ApplicationExecutorOptions } from '../schema';

export function validateOptions(options: ApplicationExecutorOptions): void {
  const { version: angularVersion } = getInstalledAngularVersionInfo();

  if (lt(angularVersion, '19.0.0')) {
    if (options.outputMode) {
      throw new Error(
        `The "outputMode" option requires Angular version 19.0.0 or greater. You are currently using version ${angularVersion}.`
      );
    }

    if (options.stylePreprocessorOptions?.sass) {
      throw new Error(
        `The "stylePreprocessorOptions.sass" option requires Angular version 19.0.0 or greater. You are currently using version ${angularVersion}.`
      );
    }

    if (typeof options.ssr === 'object' && options.ssr?.experimentalPlatform) {
      throw new Error(
        `The "ssr.experimentalPlatform" option requires Angular version 19.0.0 or greater. You are currently using version ${angularVersion}.`
      );
    }

    if (options.security !== undefined) {
      throw new Error(
        `The "security" option requires Angular version 19.0.0 or greater. You are currently using version ${angularVersion}.`
      );
    }

    if (typeof options.server === 'boolean' && options.server === false) {
      throw new Error(
        `The "false" value for the "server" option requires Angular version 19.0.0 or greater. You are currently using version ${angularVersion}.`
      );
    }
  }

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
}
