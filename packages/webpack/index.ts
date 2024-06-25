import { configurationGenerator } from './src/generators/configuration/configuration';
import { NxAppWebpackPlugin } from './src/plugins/nx-webpack-plugin/nx-app-webpack-plugin';
import { NxTsconfigPathsWebpackPlugin as _NxTsconfigPathsWebpackPlugin } from './src/plugins/nx-typescript-webpack-plugin/nx-tsconfig-paths-webpack-plugin';
import { convertConfigToWebpackPluginGenerator } from './src/generators/convert-config-to-webpack-plugin/convert-config-to-webpack-plugin';
import { useLegacyNxPlugin } from './src/plugins/use-legacy-nx-plugin/use-legacy-nx-plugin';

export {
  configurationGenerator,
  convertConfigToWebpackPluginGenerator,
  useLegacyNxPlugin,
};

// Exported for backwards compatibility in case a plugin is using the old name.
/** @deprecated Use `configurationGenerator` instead. */
export const webpackProjectGenerator = configurationGenerator;

// TODO(v20): Remove this in favor of deep imports in order to load configs faster (150-200ms faster).
/** @deprecated Use NxAppWebpackPlugin from `@nx/webpack/app-plugin` instead. */
export const NxWebpackPlugin = NxAppWebpackPlugin;
/** @deprecated Use NxTsconfigPathsWebpackPlugin from `@nx/webpack/tsconfig-paths-plugin` instead. */
export const NxTsconfigPathsWebpackPlugin = _NxTsconfigPathsWebpackPlugin;

export * from './src/utils/create-copy-plugin';
export * from './src/utils/config';
export { webpackInitGenerator } from './src/generators/init/init';
export type { WebDevServerOptions } from './src/executors/dev-server/schema';
export * from './src/executors/dev-server/dev-server.impl';
export * from './src/executors/webpack/lib/normalize-options';
export type {
  WebpackExecutorOptions,
  NormalizedWebpackExecutorOptions,
  AssetGlobPattern,
  FileReplacement,
} from './src/executors/webpack/schema';
export * from './src/executors/webpack/webpack.impl';
export * from './src/utils/get-css-module-local-ident';
export * from './src/utils/with-nx';
export * from './src/utils/with-web';
export * from './src/utils/module-federation/public-api';
