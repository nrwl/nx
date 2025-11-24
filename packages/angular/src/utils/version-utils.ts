import { coerce, major } from 'semver';
import type {
  PackageCompatVersions,
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
    ? backwardCompatibleVersions[angularMajorVersion]?.[pkgVersionName] ??
        versions[pkgVersionName]
    : versions[pkgVersionName];
}

export function getPkgVersionsForAngularMajorVersion(
  angularMajorVersion: number
): PackageCompatVersions {
  return angularMajorVersion < major(coerce(angularVersion))
    ? backwardCompatibleVersions[angularMajorVersion] ?? versions
    : versions;
}
