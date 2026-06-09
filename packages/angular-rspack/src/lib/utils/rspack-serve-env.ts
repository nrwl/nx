/**
 * `@rspack/dev-server` v1 wrapped `webpack-dev-server`, whose `Server.js`
 * sets `process.env.WEBPACK_SERVE = 'true'` at module load. v2 dropped that
 * dependency and never sets the env var, so the `WEBPACK_SERVE` checks
 * across angular-rspack silently fall through to build mode. Sniff the
 * rspack-cli command on `process.argv` as the v2 fallback.
 */

function isServeCliCommand(): boolean {
  const cmd = process.argv[2];
  return cmd === 'serve' || cmd === 'server' || cmd === 's' || cmd === 'dev';
}

export function isServeMode(): boolean {
  return !!process.env['WEBPACK_SERVE'] || isServeCliCommand();
}

/** Set `WEBPACK_SERVE` from argv so downstream consumers reading the raw
 *  env var (generated configs, MF plugins, etc.) see it on rspack 2. Safe
 *  to call multiple times. */
export function bridgeRspackServeEnv(): void {
  if (process.env['WEBPACK_SERVE']) return;
  if (isServeCliCommand()) process.env['WEBPACK_SERVE'] = 'true';
}
