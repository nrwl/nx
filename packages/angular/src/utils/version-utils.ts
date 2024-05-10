import { coerce, major } from 'semver';
import type {
  PackageCompatVersions,
  PackageLatestVersions,
  PackageVersionNames,
} from './backward-compatible-versions';
import { backwardCompatibleVersions } from './backward-compatible-versions';
import * as versions from './versions';
import { angularVersion } from './versions';

export function getPkgVersionForAngularMajorVersion(
  pkgVersionName: PackageVersionNames,
  angularMajorVersion: number
): string {
  return angularMajorVersion < major(coerce(angularVersion))
    ? backwardCompatibleVersions[`angularV${angularMajorVersion}`]?.[
        pkgVersionName
      ] ?? versions[pkgVersionName]
    : versions[pkgVersionName];
}

export function getPkgVersionsForAngularMajorVersion(
  angularMajorVersion: number
): PackageLatestVersions | PackageCompatVersions {
  return angularMajorVersion < major(coerce(angularVersion))
    ? backwardCompatibleVersions[`angularV${angularMajorVersion}`] ?? versions
    : versions;
}
