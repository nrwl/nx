import type { NextConfig } from 'next';
import type {
  NextConfigFn,
  NextPlugin,
  NextPluginThatReturnsConfigFn,
} from './config';

/** @deprecated Removed in Nx v24. This inert stub only keeps old configs loadable. */
export function composePlugins(
  ..._plugins: (NextPlugin | NextPluginThatReturnsConfigFn)[]
): (baseConfig: NextConfig) => NextConfigFn {
  return (baseConfig) => async () => baseConfig;
}
