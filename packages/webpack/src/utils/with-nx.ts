import type { Configuration } from 'webpack';
import type { NxComposableWebpackPlugin } from './config';
import { warnWebpackComposeHelpersDeprecation } from './deprecation';
import type { NxAppWebpackPluginOptions } from '../plugins/nx-webpack-plugin/nx-app-webpack-plugin-options';

export type WithNxOptions = Partial<NxAppWebpackPluginOptions>;

// TODO(v25): remove the inert config-helper stubs in this file.
/**
 * @deprecated Use `NxAppWebpackPlugin` from `@nx/webpack/app-plugin`.
 * This inert stub will be removed in Nx v25.
 */
export function withNx(
  _options: WithNxOptions = {}
): NxComposableWebpackPlugin {
  warnWebpackComposeHelpersDeprecation();
  return (config: Configuration) => config;
}
