import { Configuration } from '@rspack/core';
import { SharedConfigContext } from './model';
import { withWeb } from './with-web';

export function withReact(opts = {}) {
  return function makeConfig(
    config: Configuration,
    { options, context }: SharedConfigContext
  ): Configuration {
    const isDev =
      process.env.NODE_ENV === 'development' || options.mode === 'development';

    config = withWeb({ ...opts, cssModules: true })(config, {
      options,
      context,
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ReactRefreshPlugin = require('@rspack/plugin-react-refresh');

    const react = {
      runtime: 'automatic',
      development: isDev,
      refresh: isDev,
    };

    return {
      ...config,
      plugins: [
        ...(config.plugins || []),
        isDev && new ReactRefreshPlugin(),
      ].filter(Boolean),
      module: {
        ...config.module,
        rules: [
          ...(config.module.rules || []),
          {
            test: /\.jsx$/,
            loader: 'builtin:swc-loader',
            exclude: /node_modules/,
            options: {
              jsc: {
                parser: {
                  syntax: 'ecmascript',
                  jsx: true,
                },
                transform: {
                  react,
                },
                externalHelpers: true,
              },
            },
            type: 'javascript/auto',
          },
          {
            test: /\.tsx$/,
            loader: 'builtin:swc-loader',
            exclude: /node_modules/,
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                  tsx: true,
                },
                transform: {
                  react,
                },
                externalHelpers: true,
              },
            },
            type: 'javascript/auto',
          },
        ],
      },
    };
  };
}
