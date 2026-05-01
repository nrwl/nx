import { getInstalledAngularVersionInfo } from '../../utilities/angular-version-utils';
import type { ApplicationExecutorOptions } from '../schema';

export function normalizeOptions(
  options: ApplicationExecutorOptions
): ApplicationExecutorOptions {
  const { major: angularMajorVersion } = getInstalledAngularVersionInfo();

  let sourceMap = options.sourceMap;
  if (
    sourceMap &&
    typeof sourceMap === 'object' &&
    sourceMap.sourcesContent !== undefined &&
    angularMajorVersion < 20
  ) {
    delete sourceMap.sourcesContent;
  }

  return { ...options, sourceMap };
}
