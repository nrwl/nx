import { Configuration } from '@rspack/core';
import { NxRspackExecutionContext } from './config';
import { withWeb, WithWebOptions } from './with-web';
import { applyReactConfig } from './lib/apply-react-config';
import { SvgrOptions } from './model';

export interface WithReactOptions extends WithWebOptions {
  svgr?: boolean | SvgrOptions;
}

export function withReact(opts: WithReactOptions = {}) {
  return function makeConfig(
    config: Configuration,
    { options, context }: NxRspackExecutionContext
  ): Configuration {
    config = withWeb({ ...opts, cssModules: true })(config, {
      options,
      context,
    });

    applyReactConfig(opts, config);
    return config;
  };
}
