import { installedPlaywrightIsBelow } from './installed-playwright';
import { minPlaywrightVersionIgnoringNpmConfigProxy } from './versions';

/**
 * Whether the installed Playwright routes its probe by npm's `npm_config_*`
 * proxy variables as well as the standard ones, which it did until 1.59.0
 * dropped them. The readiness gate and its graph-time inference follow the
 * installed version: ignoring a variable that version's own probe reads would
 * send the gate a different way than Playwright. `version` is the installed
 * version as `installedPlaywrightVersion` reads it; an unresolvable or
 * unparseable installation (`null`) reads as ignoring them, the semantics of
 * current versions.
 */
export function installedPlaywrightReadsNpmConfigProxy(
  version: string | null
): boolean {
  return installedPlaywrightIsBelow(
    version,
    minPlaywrightVersionIgnoringNpmConfigProxy
  );
}
