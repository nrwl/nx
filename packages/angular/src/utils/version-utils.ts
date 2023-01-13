import { coerce, major } from 'semver';
import { angularVersion, versions as versionsMap } from './versions';
import * as versions from './versions';

export function getPkgVersionForAngularMajorVersion(
  pkgVersionName: Exclude<keyof typeof versions, 'versions'>,
  angularMajorVersion: number
): string {
  return angularMajorVersion < major(coerce(angularVersion))
    ? versionsMap[`angularV${angularMajorVersion}`]?.[pkgVersionName] ??
        versions[pkgVersionName]
    : versions[pkgVersionName];
}
