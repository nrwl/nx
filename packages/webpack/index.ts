export * from './src/utils/create-copy-plugin';
export * from './src/utils/config';
export * from './src/generators/init/init';
export * from './src/generators/webpack-project/webpack-project';
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
