import type { Configuration } from 'webpack';
import type { NxWebpackExecutionContext, WithWebOptions } from '@nx/webpack';
import { applyReactConfig } from './nx-react-webpack-plugin/lib/apply-react-config';

const processed = new Set();

export interface SvgrOptions {
  svgo?: boolean;
  titleProp?: boolean;
  ref?: boolean;
}
export interface WithReactOptions extends WithWebOptions {
  svgr?: boolean | SvgrOptions;
}

/**
 * @param {WithReactOptions} pluginOptions
 * @returns {NxWebpackPlugin}
 */
export function withReact(pluginOptions: WithReactOptions = {}) {
  return function configure(
    config: Configuration,
    context: NxWebpackExecutionContext
  ): Configuration {
    const { withWeb } = require('@nx/webpack');

    if (processed.has(config)) return config;

    // Apply web config for CSS, JSX, index.html handling, etc.
    config = withWeb(pluginOptions)(config, context);

    applyReactConfig(pluginOptions, config);

    processed.add(config);
    return config;
  };
}
