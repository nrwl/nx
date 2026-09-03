import { join } from 'path';

export const nxVersion = require(
  join('@nx/playwright', 'package.json')
).version;
export const minSupportedPlaywrightVersion = '1.36.0';
export const minPlaywrightVersionForBlobReports = '1.37.0';
// Earlier versions never verify the origin certificate of an https url probed
// through a proxy tunnel, whatever the caller asked for.
// TODO(v25): drop with the unverified-tunnel branch once
// minSupportedPlaywrightVersion reaches 1.59.0.
export const minPlaywrightVersionVerifyingProxiedTls = '1.59.0';
// Earlier versions bundle a `proxy-from-env` that also reads npm's
// `npm_config_*` proxy variables ahead of the standard ones.
// TODO(v25): drop with the npm_config_* proxy handling once
// minSupportedPlaywrightVersion reaches 1.59.0.
export const minPlaywrightVersionIgnoringNpmConfigProxy = '1.59.0';
export const playwrightVersion = '^1.37.0';
export const eslintPluginPlaywrightVersion = '^1.6.2';
