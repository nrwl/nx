import type { Configuration } from 'webpack';
import type { NxComposableWebpackPlugin } from './config';
import { warnWebpackComposeHelpersDeprecation } from './deprecation';
import type { NxAppWebpackPluginOptions } from '../plugins/nx-webpack-plugin/nx-app-webpack-plugin-options';

export type WithNxOptions = Partial<NxAppWebpackPluginOptions>;

/** @deprecated Removed in Nx v24. This inert stub only keeps old configs loadable. */
export function withNx(
  _options: WithNxOptions = {}
): NxComposableWebpackPlugin {
  warnWebpackComposeHelpersDeprecation();
  return (config: Configuration) => config;
}
