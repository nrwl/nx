import type { Configuration } from '@rspack/core';
import type { NxComposableRspackPlugin } from './config';
import { warnRspackComposeHelpersDeprecation } from './deprecation';
import type { NxAppRspackPluginOptions } from '../plugins/utils/models';

export type WithNxOptions = Partial<NxAppRspackPluginOptions>;

/** @deprecated Removed in Nx v24. This inert stub only keeps old configs loadable. */
export function withNx(_options: WithNxOptions = {}): NxComposableRspackPlugin {
  warnRspackComposeHelpersDeprecation();
  return (config: Configuration) => config;
}
