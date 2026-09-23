import type { Configuration } from 'webpack';
import type { NxWebpackExecutionContext, WithWebOptions } from '@nx/webpack';
import { warnReactWithReactDeprecation } from '../src/utils/deprecation';

export interface WithReactOptions extends WithWebOptions {}

/** @deprecated Removed in Nx v24. This inert stub only keeps old configs loadable. */
export function withReact(_options: WithReactOptions = {}) {
  warnReactWithReactDeprecation();
  return (
    config: Configuration,
    _context?: NxWebpackExecutionContext
  ): Configuration => config;
}
