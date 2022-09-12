/**
 * This is here for backwards-compat.
 * TODO(jack): remove in Nx 16.
 */
import {
  webpackExecutor,
  WebpackExecutorOptions as WebWebpackExecutorOptions,
} from '@nrwl/webpack';

export { webpackExecutor, WebWebpackExecutorOptions };
export default webpackExecutor;
