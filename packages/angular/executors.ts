export * from './src/builders/module-federation-dev-ssr/module-federation-dev-ssr.impl';
export * from './src/builders/webpack-browser/webpack-browser.impl';
export * from './src/builders/webpack-server/webpack-server.impl';
export * from './src/executors/module-federation-dev-server/module-federation-dev-server.impl';
export * from './src/executors/delegate-build/delegate-build.impl';
export * from './src/executors/ng-packagr-lite/ng-packagr-lite.impl';
export * from './src/executors/package/package.impl';
export * from './src/executors/browser-esbuild/browser-esbuild.impl';
export * from './src/executors/application/application.impl';
export * from './src/executors/extract-i18n/extract-i18n.impl';

import { executeDevServerBuilder } from './src/builders/dev-server/dev-server.impl';

export {
  // TODO(v20): remove this alias
  /**
   * @deprecated Use executeDevServerBuilder instead. It will be removed in Nx v20.
   */
  executeDevServerBuilder as executeWebpackDevServerBuilder,
  executeDevServerBuilder,
};
