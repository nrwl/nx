import { checkAndCleanWithSemver as _checkAndCleanWithSemver } from '@nx/devkit/src/utils/semver';
import { logger } from '@nx/devkit';

/** @deprecated Use checkAndCleanWithSemver from @nx/devkit/src/utils/semver instead.
 * TODO(v17): Remove this function from workspace. Keep it for now since there are projects that use it (e.g. https://github.com/gperdomor/nx-tools).
 */
export function checkAndCleanWithSemver(pkgName: string, version: string) {
  logger.warn(
    `checkAndCleanWithSemver has been moved to @nx/devkit/src/utils/semver`
  );
  return _checkAndCleanWithSemver(pkgName, version);
}
