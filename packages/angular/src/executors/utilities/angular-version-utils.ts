import { getInstalledPackageVersion } from '@nx/devkit/internal';
import { major } from 'semver';

export type VersionInfo = { major: number; version: string };

export function getInstalledAngularVersionInfo(): VersionInfo | null {
  return getInstalledPackageVersionInfo('@angular/core');
}

export function getInstalledPackageVersionInfo(
  pkgName: string
): VersionInfo | null {
  const version = getInstalledPackageVersion(pkgName);
  return version ? { major: major(version), version } : null;
}
