import type { Configuration } from '@rspack/core';
import { NxRspackExecutionContext } from './config';
import { withWeb, WithWebOptions } from './with-web';
import { applyReactConfig } from '../plugins/utils/apply-react-config';
import { warnRspackComposeHelpersDeprecation } from './deprecation';

export interface WithReactOptions extends WithWebOptions {}

/**
 * @deprecated Will be removed in Nx v24. Use `NxReactRspackPlugin` from
 * `@nx/rspack/react-plugin` in a standard rspack config and run
 * `nx g @nx/rspack:convert-to-inferred`. See
 * https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.
 */
export function withReact(opts: WithReactOptions = {}) {
  warnRspackComposeHelpersDeprecation();
  return async function makeConfig(
    config: Configuration,
    { options, context }: NxRspackExecutionContext
  ): Promise<Configuration> {
    config = await withWeb({ ...opts, cssModules: true })(config, {
      options,
      context,
    });

    applyReactConfig({}, config);
    return config;
  };
}
