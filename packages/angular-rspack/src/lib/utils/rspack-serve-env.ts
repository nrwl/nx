/**
 * v1: `@rspack/dev-server` wraps `webpack-dev-server`, which sets
 * `process.env.WEBPACK_SERVE = 'true'` at module load.
 * v2: `@rspack/dev-server` sets `process.env.RSPACK_SERVE = 'true'` at
 * module load instead. Either signal indicates serve mode.
 *
 * Both are set before the user config is loaded — rspack-cli's `serve`
 * command imports `@rspack/dev-server` before invoking the config loader.
 */
export function isServeMode(): boolean {
  return !!process.env['WEBPACK_SERVE'] || !!process.env['RSPACK_SERVE'];
}
