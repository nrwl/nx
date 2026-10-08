import type { Configuration } from '@rspack/core';
import type { NxComposableRspackPlugin } from './config';
import { warnRspackComposeHelpersDeprecation } from './deprecation';
import type { WithWebOptions } from './with-web';

export interface WithReactOptions extends WithWebOptions {}

/** @deprecated Removed in Nx v24. This inert stub only keeps old configs loadable. */
export function withReact(
  _options: WithReactOptions = {}
): NxComposableRspackPlugin {
  warnRspackComposeHelpersDeprecation();
  return (config: Configuration) => config;
}
