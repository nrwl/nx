import { getVersion } from 'jest';
import { major } from 'semver';

export function getInstalledJestVersion(): string | null {
  try {
    return getVersion();
  } catch {
    return null;
  }
}

export function getInstalledJestMajorVersion(): number | null {
  const installedVersion = getInstalledJestVersion();

  return installedVersion ? major(installedVersion) : null;
}
