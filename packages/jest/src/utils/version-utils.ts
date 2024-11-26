import { major } from 'semver';

export function getInstalledJestVersion(): string | null {
  try {
    return require('jest/package.json').version;
  } catch {
    return null;
  }
}

export function getInstalledJestMajorVersion(): number | null {
  const installedVersion = getInstalledJestVersion();

  return installedVersion ? major(installedVersion) : null;
}
