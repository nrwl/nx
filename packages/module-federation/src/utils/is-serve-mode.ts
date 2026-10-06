// v1 dev-server sets WEBPACK_SERVE on module load; v2 sets RSPACK_SERVE.
// rspack-cli imports the dev-server before loading the user config.
export function isServeMode(): boolean {
  return !!process.env['WEBPACK_SERVE'] || !!process.env['RSPACK_SERVE'];
}

export function childBuildEnv(): NodeJS.ProcessEnv {
  const { WEBPACK_SERVE, RSPACK_SERVE, ...rest } = process.env;
  return {
    ...rest,
    // Static remotes for a dev-server session are development builds.
    // angular-rspack picks production when no serve signal is present, which
    // would enforce bundle budgets and optimization on a dev workflow.
    NGRS_CONFIG: rest.NGRS_CONFIG ?? 'development',
  };
}
