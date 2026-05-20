/**
 * `@rspack/dev-server` v1 wrapped `webpack-dev-server`, whose `Server.js`
 * sets `process.env.WEBPACK_SERVE = 'true'` at module load. v2 is a
 * ground-up rewrite that drops that dependency and never sets the env
 * var, so the `process.env['WEBPACK_SERVE']` checks across the module-
 * federation dev-server plugins silently fall through to build mode.
 *
 * Detect serve mode from the rspack CLI command on `process.argv` and
 * bridge it back to `WEBPACK_SERVE` so existing checks keep working on
 * rspack 2 without touching user configs. Safe to call multiple times.
 */
export function bridgeRspackServeEnv(): void {
  if (process.env['WEBPACK_SERVE']) return;
  const command = process.argv[2];
  if (
    command === 'serve' ||
    command === 'server' ||
    command === 's' ||
    command === 'dev'
  ) {
    process.env['WEBPACK_SERVE'] = 'true';
  }
}
