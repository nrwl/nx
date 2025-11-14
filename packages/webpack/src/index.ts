import { configurationGenerator } from './generators/configuration/configuration.js';
import { NxAppWebpackPlugin } from './plugins/nx-webpack-plugin/nx-app-webpack-plugin.js';
import { NxTsconfigPathsWebpackPlugin as _NxTsconfigPathsWebpackPlugin } from './plugins/nx-typescript-webpack-plugin/nx-tsconfig-paths-webpack-plugin.js';
import { useLegacyNxPlugin } from './plugins/use-legacy-nx-plugin/use-legacy-nx-plugin.js';

// Lazy-loaded to avoid requiring typescript before it's installed.
// Other generators may import this index before typescript is available.
// This generator imports @phenomnomnominal/tsquery which requires typescript.
// Note: This seems to only affect yarn v1.
export function convertConfigToWebpackPluginGenerator(
  ...args: Parameters<
    typeof import('./generators/convert-config-to-webpack-plugin/convert-config-to-webpack-plugin.js').convertConfigToWebpackPluginGenerator
  >
) {
  return require('./generators/convert-config-to-webpack-plugin/convert-config-to-webpack-plugin').convertConfigToWebpackPluginGenerator(
    ...args
  );
}

export { configurationGenerator, useLegacyNxPlugin };

// Exported for backwards compatibility in case a plugin is using the old name.
/** @deprecated Use `configurationGenerator` instead. */
export const webpackProjectGenerator = configurationGenerator;

/** @deprecated Use NxAppWebpackPlugin from `@nx/webpack/app-plugin` instead, which can improve graph creation by 150-200ms per file. */
export const NxWebpackPlugin = NxAppWebpackPlugin;
/** @deprecated Use NxTsconfigPathsWebpackPlugin from `@nx/webpack/tsconfig-paths-plugin` instead. */
export const NxTsconfigPathsWebpackPlugin = _NxTsconfigPathsWebpackPlugin;

export * from './utils/create-copy-plugin.js';
export * from './utils/config.js';
export { webpackInitGenerator } from './generators/init/init.js';
export type { WebDevServerOptions } from './executors/dev-server/schema';
export * from './executors/dev-server/dev-server.impl.js';
export * from './executors/webpack/lib/normalize-options.js';
export type {
  WebpackExecutorOptions,
  NormalizedWebpackExecutorOptions,
  AssetGlobPattern,
  FileReplacement,
} from './executors/webpack/schema';
export * from './executors/webpack/webpack.impl.js';
export * from './utils/get-css-module-local-ident.js';
export * from './utils/with-nx.js';
export * from './utils/with-web.js';
export * from './utils/e2e-web-server-info-utils.js';
