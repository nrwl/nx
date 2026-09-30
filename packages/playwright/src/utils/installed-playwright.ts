import { getInstalledPackageVersion } from '@nx/devkit/internal';
import { lt, valid } from 'semver';

/**
 * The version of the `@playwright/test` resolved from `requirePaths`, the
 * directories the install is resolved from, the project root first so a
 * pnpm-isolated copy wins over a hoisted one. `null` when none resolves or its
 * version does not parse.
 */
export function installedPlaywrightVersion(
  requirePaths: string[]
): string | null {
  if (requirePaths.length === 0) {
    return null;
  }
  const version = getInstalledPackageVersion('@playwright/test', requirePaths);
  return version !== null && valid(version) !== null ? version : null;
}

/** Whether an installed version read by `installedPlaywrightVersion` is older than `floor`. */
export function installedPlaywrightIsBelow(
  version: string | null,
  floor: string
): boolean {
  return version !== null && lt(version, floor);
}
