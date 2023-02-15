import { Configuration } from '@rspack/core';
import { SharedConfigContext } from './model';
import { withWeb } from './with-web';

export function withReact(opts = {}) {
  return function makeConfig(
    config: Configuration,
    { options, context }: SharedConfigContext
  ): Configuration {
    const isDev = process.env.NODE_ENV === 'development';

    config = withWeb(opts)(config, { options, context });

    return {
      ...config,
      builtins: {
        ...config.builtins,
        react: {
          runtime: 'automatic',
          development: isDev,
          refresh: isDev,
        },
      },
    };
  };
}
