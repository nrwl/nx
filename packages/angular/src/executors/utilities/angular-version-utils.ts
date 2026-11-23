import { getInstalledPackageVersion } from '@nx/devkit/internal';
import { major } from 'semver';

export type VersionInfo = { major: number; version: string };

export function getInstalledAngularVersionInfo(): VersionInfo {
  const versionInfo = getInstalledPackageVersionInfo('@angular/core');
  if (!versionInfo) {
    throw new Error('Could not find the installed version of "@angular/core".');
  }
  return versionInfo;
}

export function getInstalledPackageVersionInfo(
  pkgName: string
): VersionInfo | null {
  const version = getInstalledPackageVersion(pkgName);
  return version ? { major: major(version), version } : null;
}
