import { Configuration } from '@rspack/core';
import { SharedConfigContext } from './model';

export function composePlugins(...plugins: any[]) {
  return async function combined(
    config: Configuration,
    ctx: SharedConfigContext
  ): Promise<Configuration> {
    for (const plugin of plugins) {
      const fn = await plugin;
      config = await fn(config, ctx);
    }
    return config;
  };
}
