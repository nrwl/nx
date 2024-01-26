import { lt } from 'semver';
import { getInstalledAngularVersionInfo } from '../../utilities/angular-version-utils';
import type { ApplicationExecutorOptions } from '../schema';

export function validateOptions(options: ApplicationExecutorOptions): void {
  const { major: angularMajorVersion, version: angularVersion } =
    getInstalledAngularVersionInfo();

  if (angularMajorVersion < 17) {
    throw new Error(
      `The "application" executor requires Angular version 17 or greater. You are currently using version ${angularVersion}.`
    );
  }

  if (options.loader && lt(angularVersion, '17.1.0')) {
    throw new Error(
      `The "loader" option requires Angular version 17.1.0 or greater. You are currently using version ${angularVersion}.`
    );
  }

  if (options.indexHtmlTransformer && lt(angularVersion, '17.1.0')) {
    throw new Error(
      `The "indexHtmlTransformer" option requires Angular version 17.1.0 or greater. You are currently using version ${angularVersion}.`
    );
  }

  if (
    typeof options.index === 'object' &&
    options.index.preloadInitial !== undefined &&
    lt(angularVersion, '17.1.0')
  ) {
    throw new Error(
      `The "index.preloadInitial" option requires Angular version 17.1.0 or greater. You are currently using version ${angularVersion}.`
    );
  }

  if (
    options.optimization &&
    typeof options.optimization !== 'boolean' &&
    options.optimization.styles &&
    typeof options.optimization.styles !== 'boolean' &&
    lt(angularVersion, '17.1.0')
  ) {
    if (options.optimization.styles.removeSpecialComments === false) {
      throw new Error(
        `The "optimization.styles.removeSpecialComments" option requires Angular version 17.1.0 or greater. You are currently using version ${angularVersion}.`
      );
    } else if (options.optimization.styles.removeSpecialComments === true) {
      // silently remove the option, as it was the default before 17.1.0
      delete options.optimization.styles.removeSpecialComments;
    }
  }

  if (typeof options.outputPath === 'object' && lt(angularVersion, '17.1.0')) {
    throw new Error(
      `The "outputPath" option as an object requires Angular version 17.1.0 or greater. You are currently using version ${angularVersion}.`
    );
  }
}
