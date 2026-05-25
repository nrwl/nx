import type { Configuration } from '@rspack/core';
import { NxRspackExecutionContext } from './config';
import { withWeb, WithWebOptions } from './with-web';
import { applyReactConfig } from '../plugins/utils/apply-react-config';

export interface WithReactOptions extends WithWebOptions {}

export function withReact(opts: WithReactOptions = {}) {
  return function makeConfig(
    config: Configuration,
    { options, context }: NxRspackExecutionContext
  ): Configuration {
    config = withWeb({ ...opts, cssModules: true })(config, {
      options,
      context,
    });

    applyReactConfig({}, config);
    return config;
  };
}
