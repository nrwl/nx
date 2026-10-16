import type { Configuration } from 'webpack';
import type { NxWebpackExecutionContext, WithWebOptions } from '@nx/webpack';
import { warnReactWithReactDeprecation } from '../src/utils/deprecation';

export interface WithReactOptions extends WithWebOptions {}

// TODO(v25): remove the inert config-helper stubs in this file.
/**
 * @deprecated Use `NxReactWebpackPlugin` from `@nx/react/webpack-plugin`.
 * This inert stub will be removed in Nx v25.
 */
export function withReact(_options: WithReactOptions = {}) {
  warnReactWithReactDeprecation();
  return (
    config: Configuration,
    _context?: NxWebpackExecutionContext
  ): Configuration => config;
}
