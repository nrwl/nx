import { configurationGenerator } from './src/generators/configuration/configuration.js';
import { NxAppWebpackPlugin } from './src/plugins/nx-webpack-plugin/nx-app-webpack-plugin.js';
import { NxTsconfigPathsWebpackPlugin as _NxTsconfigPathsWebpackPlugin } from './src/plugins/nx-typescript-webpack-plugin/nx-tsconfig-paths-webpack-plugin.js';
import { useLegacyNxPlugin } from './src/plugins/use-legacy-nx-plugin/use-legacy-nx-plugin.js';

// Lazy-loaded to avoid requiring typescript before it's installed.
// Other generators may import this index before typescript is available.
// This generator imports @phenomnomnominal/tsquery which requires typescript.
// Note: This seems to only affect yarn v1.
export function convertConfigToWebpackPluginGenerator(
  ...args: Parameters<
    typeof import('./src/generators/convert-config-to-webpack-plugin/convert-config-to-webpack-plugin.js').convertConfigToWebpackPluginGenerator
  >
) {
  return require('./src/generators/convert-config-to-webpack-plugin/convert-config-to-webpack-plugin').convertConfigToWebpackPluginGenerator(
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

export * from './src/utils/create-copy-plugin.js';
export * from './src/utils/config.js';
export { webpackInitGenerator } from './src/generators/init/init.js';
export type { WebDevServerOptions } from './src/executors/dev-server/schema';
export * from './src/executors/dev-server/dev-server.impl.js';
export * from './src/executors/webpack/lib/normalize-options.js';
export type {
  WebpackExecutorOptions,
  NormalizedWebpackExecutorOptions,
  AssetGlobPattern,
  FileReplacement,
} from './src/executors/webpack/schema';
export * from './src/executors/webpack/webpack.impl.js';
export * from './src/utils/get-css-module-local-ident.js';
export * from './src/utils/with-nx.js';
export * from './src/utils/with-web.js';
export * from './src/utils/e2e-web-server-info-utils.js';
