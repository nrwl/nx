import { readModulePackageJson } from 'nx/src/utils/package-json';
import { major } from 'semver';

type AngularVersionInfo = { major: number; version: string };

export function getInstalledAngularVersionInfo(): AngularVersionInfo | null {
  try {
    const {
      packageJson: { version },
    } = readModulePackageJson('@angular/core');

    return { major: major(version), version };
  } catch {
    return null;
  }
}
