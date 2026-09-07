import { installedPlaywrightIsBelow } from './installed-playwright';
import { minPlaywrightVersionVerifyingProxiedTls } from './versions';

/**
 * Whether the installed Playwright probes an https url tunnelled through a
 * proxy without verifying the origin certificate, which it did until 1.59.0
 * started honoring the caller's setting. The readiness gate and its graph-time
 * inference follow the installed version: verifying where that version's own
 * probe does not would fail a wait Playwright itself would pass, and counting
 * TLS material that probe never reads would drop a gate for nothing.
 * `version` is the installed version as `installedPlaywrightVersion` reads it;
 * an unresolvable or unparseable installation (`null`) reads as verifying, the
 * semantics of current versions.
 */
export function installedPlaywrightSkipsProxiedTls(
  version: string | null
): boolean {
  return installedPlaywrightIsBelow(
    version,
    minPlaywrightVersionVerifyingProxiedTls
  );
}
