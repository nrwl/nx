// v1 dev-server sets WEBPACK_SERVE on module load; v2 sets RSPACK_SERVE.
// rspack-cli imports the dev-server before loading the user config.
export function isServeMode(): boolean {
  return !!process.env['WEBPACK_SERVE'] || !!process.env['RSPACK_SERVE'];
}
