import type { Configuration } from '@rspack/core';
import type { NxComposableRspackPlugin } from './config';
import { warnRspackComposeHelpersDeprecation } from './deprecation';
import type { WithWebOptions } from './with-web';

export interface WithReactOptions extends WithWebOptions {}

// TODO(v25): remove the inert config-helper stubs in this file.
/**
 * @deprecated Use `NxReactRspackPlugin` from `@nx/rspack/react-plugin`.
 * This inert stub will be removed in Nx v25.
 */
export function withReact(
  _options: WithReactOptions = {}
): NxComposableRspackPlugin {
  warnRspackComposeHelpersDeprecation();
  return (config: Configuration) => config;
}
