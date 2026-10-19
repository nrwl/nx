import type { Configuration } from '@rspack/core';
import type { NxComposableRspackPlugin } from './config';
import { warnRspackComposeHelpersDeprecation } from './deprecation';
import type { NxAppRspackPluginOptions } from '../plugins/utils/models';

export type WithNxOptions = Partial<NxAppRspackPluginOptions>;

// TODO(v25): remove the inert config-helper stubs in this file.
/**
 * @deprecated Use `NxAppRspackPlugin` from `@nx/rspack/app-plugin`.
 * This inert stub will be removed in Nx v25.
 */
export function withNx(_options: WithNxOptions = {}): NxComposableRspackPlugin {
  warnRspackComposeHelpersDeprecation();
  return (config: Configuration) => config;
}
