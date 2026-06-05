// Curated internal API surface for other first-party Nx plugins (e.g. @nx/react,
// @nx/angular, @nx/web, @nx/node, @nx/next, @nx/react-native). Prefer this over
// deep `@nx/webpack/src/*` imports — those are not part of the public API.
//
// Only truly-internal symbols belong here. Anything exported from @nx/webpack's
// public entry (composePluginsSync, withNx, withWeb, normalizeOptions,
// normalizePluginPath, devServerExecutor, NormalizedWebpackExecutorOptions, …)
// must be imported from '@nx/webpack', not from here.
export { findUp, findAllNodeModules, deleteOutputDir } from './src/utils/fs';
export { ensureDependencies } from './src/utils/ensure-dependencies';
export type { EnsureDependenciesOptions } from './src/utils/ensure-dependencies';
export { resolveUserDefinedWebpackConfig } from './src/utils/webpack/resolve-user-defined-webpack-config';
export { suppressWebpackComposeHelperWarnings } from './src/utils/deprecation';
export { WebpackNxBuildCoordinationPlugin } from './src/plugins/webpack-nx-build-coordination-plugin';
export type { WebSsrDevServerOptions } from './src/executors/ssr-dev-server/schema';
export { default as ssrDevServerExecutor } from './src/executors/ssr-dev-server/ssr-dev-server.impl';
