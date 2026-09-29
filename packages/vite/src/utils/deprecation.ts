import { logger } from '@nx/devkit';

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
