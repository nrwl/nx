import { getInstalledAngularVersionInfo } from '../../utilities/angular-version-utils';
import type { ApplicationExecutorOptions } from '../schema';

export function normalizeOptions(
  options: ApplicationExecutorOptions
): ApplicationExecutorOptions {
  const { major: angularMajorVersion } = getInstalledAngularVersionInfo();

  /**
   * We can't set the default values for `security.autoCsp` and
   * `security.autoCsp.unsafeEval` in the schema because our current schema
   * parsing would (incorrectly?) default `security` to an object with the
   * `autoCsp` property set to `false`. This would be problematic because the
   * option is not supported in Angular versions < 19. So, we don't set those
   * defaults in the schema and we normalize them here correctly.
   */
  let security: ApplicationExecutorOptions['security'] = options.security;
  if (angularMajorVersion >= 19) {
    if (typeof security === 'object') {
      if (security.autoCsp === undefined) {
        security.autoCsp = false;
      } else if (
        typeof security.autoCsp === 'object' &&
        security.autoCsp.unsafeEval === undefined
      ) {
        security.autoCsp.unsafeEval = false;
      }
    }
  }

  let appShell = options.appShell;
  let prerender = options.prerender;
  if (angularMajorVersion < 19) {
    appShell ??= false;
    prerender ??= false;
  }

  let sourceMap = options.sourceMap;
  if (
    sourceMap &&
    typeof sourceMap === 'object' &&
    sourceMap.sourcesContent !== undefined &&
    angularMajorVersion < 20
  ) {
    delete sourceMap.sourcesContent;
  }

  return { ...options, appShell, prerender, security, sourceMap };
}
