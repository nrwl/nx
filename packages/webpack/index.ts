import { configurationGenerator } from './src/generators/configuration/configuration';

export { configurationGenerator };

// Exported for backwards compatibility in case a plugin is using the old name.
/** @deprecated Use `configurationGenerator` instead. */
export const webpackProjectGenerator = configurationGenerator;

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
export { NxWebpackPlugin } from './src/plugins/nx-webpack-plugin/nx-webpack-plugin';
export { NxTsconfigPathsWebpackPlugin } from './src/plugins/nx-typescript-webpack-plugin/nx-tsconfig-paths-webpack-plugin';
