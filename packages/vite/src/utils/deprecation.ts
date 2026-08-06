import { logger } from '@nx/devkit';

// TODO(v24): Remove the @nx/vite:build, @nx/vite:dev-server, and
// @nx/vite:preview-server executors. The inferred plugin (@nx/vite/plugin)
// and the convert-to-inferred generator stay supported. (`@nx/vite:test`
// is being deprecated in a separate change for the test-runner batch.)
export const VITE_BUILD_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/vite:build` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/vite:convert-to-inferred` to migrate to the `@nx/vite/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export const VITE_DEV_SERVER_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/vite:dev-server` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/vite:convert-to-inferred` to migrate to the `@nx/vite/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export const VITE_PREVIEW_SERVER_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/vite:preview-server` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/vite:convert-to-inferred` to migrate to the `@nx/vite/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export function warnViteBuildExecutorDeprecation(): void {
  logger.warn(VITE_BUILD_EXECUTOR_DEPRECATION_MESSAGE);
}

export function warnViteDevServerExecutorDeprecation(): void {
  logger.warn(VITE_DEV_SERVER_EXECUTOR_DEPRECATION_MESSAGE);
}

export function warnVitePreviewServerExecutorDeprecation(): void {
  logger.warn(VITE_PREVIEW_SERVER_EXECUTOR_DEPRECATION_MESSAGE);
}

// Fired when the @nx/vite:configuration generator is about to generate
// targets that use the deprecated executors — i.e. when @nx/vite/plugin
// isn't registered in nx.json. Surfaces the deprecation at generation time
// rather than only when the user later runs the generated targets.
export function warnViteExecutorGenerating(): void {
  logger.warn(
    'Generating targets that use the deprecated `@nx/vite:build`, `@nx/vite:dev-server`, and `@nx/vite:preview-server` executors. These executors will be removed in Nx v24. Run `nx g @nx/vite:convert-to-inferred` next to migrate these targets to the `@nx/vite/plugin` inferred plugin and prevent future generators from emitting executor targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.'
  );
}

// TODO(v24): Remove `nxViteTsPaths` and `nxCopyAssetsPlugin` helpers.
// The inferred `@nx/vite/plugin` already ensures projects extend the base
// tsconfig, so the community `vite-tsconfig-paths` package handles path
// resolution end-to-end. Asset copying is covered by Vite's native
// `publicDir` option or the `vite-plugin-static-copy` package.
export const NX_VITE_TS_PATHS_DEPRECATION_MESSAGE =
  'The `nxViteTsPaths` plugin from `@nx/vite/plugins/nx-tsconfig-paths.plugin` is deprecated and will be removed in Nx v24. Replace it with `tsconfigPaths()` from the `vite-tsconfig-paths` package. See https://nx.dev/docs/technologies/build-tools/vite/guides/configure-vite for details.';

export const NX_COPY_ASSETS_PLUGIN_DEPRECATION_MESSAGE =
  "The `nxCopyAssetsPlugin` plugin from `@nx/vite/plugins/nx-copy-assets.plugin` is deprecated and will be removed in Nx v24. Use Vite's native `publicDir` option or the `vite-plugin-static-copy` package instead. See https://nx.dev/docs/technologies/build-tools/vite/guides/configure-vite for details.";

let nxViteTsPathsWarned = false;
let nxCopyAssetsPluginWarned = false;

// Warn-once per process so users don't see the message repeated on every
// dev-server HMR reload or vitest run within the same Node process.
export function warnNxViteTsPathsDeprecation(): void {
  if (nxViteTsPathsWarned) return;
  nxViteTsPathsWarned = true;
  logger.warn(NX_VITE_TS_PATHS_DEPRECATION_MESSAGE);
}

export function warnNxCopyAssetsPluginDeprecation(): void {
  if (nxCopyAssetsPluginWarned) return;
  nxCopyAssetsPluginWarned = true;
  logger.warn(NX_COPY_ASSETS_PLUGIN_DEPRECATION_MESSAGE);
}
