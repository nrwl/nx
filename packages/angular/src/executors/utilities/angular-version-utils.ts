import { readModulePackageJson } from 'nx/src/utils/package-json';
import { major } from 'semver';

export type VersionInfo = { major: number; version: string };

export function getInstalledAngularVersionInfo(): VersionInfo | null {
  return getInstalledPackageVersionInfo('@angular/core');
}

export function getInstalledPackageVersionInfo(
  pkgName: string
): VersionInfo | null {
  try {
    const {
      packageJson: { version },
    } = readModulePackageJson(pkgName);

    return { major: major(version), version };
  } catch {
    return null;
  }
}
