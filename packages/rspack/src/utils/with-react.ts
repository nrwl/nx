import { Configuration } from '@rspack/core';
import { NxRspackExecutionContext } from './config.js';
import { withWeb, WithWebOptions } from './with-web.js';
import { applyReactConfig } from '../plugins/utils/apply-react-config.js';
import { SvgrOptions } from '../plugins/utils/models.js';

export interface WithReactOptions extends WithWebOptions {
  /**
   * @deprecated SVGR support is deprecated and will be removed in Nx 23.
   * TODO(v23): Remove SVGR support
   */
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
