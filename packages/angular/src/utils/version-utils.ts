import { coerce, major } from 'semver';
import type {
  PackageCompatVersions,
  PackageVersionNames,
} from './backward-compatible-versions';
import {
  backwardCompatibleVersions,
  supportedVersions,
} from './backward-compatible-versions';
import * as versions from './versions';
import { angularVersion } from './versions';

function getCurrentAngularMajorVersion(): number {
  const version = coerce(angularVersion);
  if (!version) {
    throw new Error(`Invalid Angular version "${angularVersion}".`);
  }
  return major(version);
}

export function getPkgVersionForAngularMajorVersion(
  pkgVersionName: PackageVersionNames,
  angularMajorVersion: number
): string {
  return angularMajorVersion < getCurrentAngularMajorVersion()
    ? (getBackwardCompatibleVersions(angularMajorVersion)?.[pkgVersionName] ??
        versions[pkgVersionName])
    : versions[pkgVersionName];
}

export function getPkgVersionsForAngularMajorVersion(
  angularMajorVersion: number
): PackageCompatVersions {
  return angularMajorVersion < getCurrentAngularMajorVersion()
    ? (getBackwardCompatibleVersions(angularMajorVersion) ?? versions)
    : versions;
}

function getBackwardCompatibleVersions(
  angularMajorVersion: number
): PackageCompatVersions | undefined {
  const version = supportedVersions.find((v) => v === angularMajorVersion);
  return version === undefined
    ? undefined
    : backwardCompatibleVersions[version];
}
