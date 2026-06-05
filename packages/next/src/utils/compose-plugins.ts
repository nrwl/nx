import type { NextConfig } from 'next';
import type {
  NextConfigFn,
  NextPlugin,
  NextPluginThatReturnsConfigFn,
} from './config';
import { warnComposePluginsDeprecation } from './deprecation';

export function composePlugins(
  ...plugins: (NextPlugin | NextPluginThatReturnsConfigFn)[]
): (baseConfig: NextConfig) => NextConfigFn {
  return function (baseConfig: NextConfig) {
    return async function combined(
      phase: string,
      context: any
    ): Promise<NextConfig> {
      warnComposePluginsDeprecation(phase);
      let config = baseConfig;
      for (const plugin of plugins) {
        const fn = await plugin;
        const configOrFn = fn(config);
        if (typeof configOrFn === 'function') {
          config = await configOrFn(phase, context);
        } else {
          config = configOrFn;
        }
      }

      return config;
    };
  };
}
