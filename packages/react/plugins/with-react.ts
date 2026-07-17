import type { Configuration } from 'webpack';
import type { NxWebpackExecutionContext, WithWebOptions } from '@nx/webpack';
import { applyReactConfig } from './nx-react-webpack-plugin/lib/apply-react-config';
import { warnReactWithReactDeprecation } from '../src/utils/deprecation';

const processed = new Set();

export interface WithReactOptions extends WithWebOptions {}

/**
 * @deprecated Will be removed in Nx v24. Use `NxReactWebpackPlugin` from
 * `@nx/react/webpack-plugin` in a standard webpack config and run
 * `nx g @nx/webpack:convert-to-inferred`. See
 * https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.
 * @param {WithReactOptions} pluginOptions
 * @returns {NxWebpackPlugin}
 */
export function withReact(pluginOptions: WithReactOptions = {}) {
  warnReactWithReactDeprecation();
  return function configure(
    config: Configuration,
    context: NxWebpackExecutionContext
  ): Configuration {
    const { withWeb } = require('@nx/webpack');

    if (processed.has(config)) return config;

    // Apply web config for CSS, JSX, index.html handling, etc.
    config = withWeb(pluginOptions)(config, context);

    applyReactConfig({}, config);

    processed.add(config);
    return config;
  };
}
