import { getInstalledPackageVersion } from '@nx/devkit/internal';
import { lt, valid } from 'semver';
import { minPlaywrightVersionVerifyingProxiedTls } from './versions';

/**
 * Whether the installed Playwright probes an https url tunnelled through a
 * proxy without verifying the origin certificate, which it did until 1.59.0
 * started honoring the caller's setting. The readiness gate and its graph-time
 * inference follow the installed version: verifying where that version's own
 * probe does not would fail a wait Playwright itself would pass, and counting
 * TLS material that probe never reads would drop a gate for nothing.
 * `requirePaths` are the directories the install is resolved from, the
 * project root first so a pnpm-isolated copy wins over a hoisted one. An
 * unresolvable or unparseable installation reads as verifying, the semantics
 * of current versions.
 */
export function installedPlaywrightSkipsProxiedTls(
  requirePaths: string[]
): boolean {
  if (requirePaths.length === 0) {
    return false;
  }
  const version = getInstalledPackageVersion('@playwright/test', requirePaths);
  return (
    version !== null &&
    valid(version) !== null &&
    lt(version, minPlaywrightVersionVerifyingProxiedTls)
  );
}
