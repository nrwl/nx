import { join } from 'path';

export const nxVersion = require(
  join('@nx/playwright', 'package.json')
).version;
export const minSupportedPlaywrightVersion = '1.36.0';
export const minPlaywrightVersionForBlobReports = '1.37.0';
// Earlier versions never verify the origin certificate of an https url probed
// through a proxy tunnel, whatever the caller asked for.
export const minPlaywrightVersionVerifyingProxiedTls = '1.59.0';
export const playwrightVersion = '^1.37.0';
export const eslintPluginPlaywrightVersion = '^1.6.2';
