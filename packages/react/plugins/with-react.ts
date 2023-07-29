import type { Configuration } from 'webpack';
import type { WithWebOptions } from '@nx/webpack';
import type { NxWebpackExecutionContext } from '@nx/webpack';

const processed = new Set();

interface WithReactOptions extends WithWebOptions {
  svgr?: false;
}

function addHotReload(config: Configuration) {
  if (config.mode === 'development' && config['devServer']?.hot) {
    // add `react-refresh/babel` to babel loader plugin
    const babelLoader = config.module.rules.find(
      (rule) =>
        rule &&
        typeof rule !== 'string' &&
        rule.loader?.toString().includes('babel-loader')
    );

    if (babelLoader && typeof babelLoader !== 'string') {
      babelLoader.options['plugins'] = [
        ...(babelLoader.options['plugins'] || []),
        [
          require.resolve('react-refresh/babel'),
          {
            skipEnvCheck: true,
          },
        ],
      ];
    }

    const ReactRefreshPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
    config.plugins.push(new ReactRefreshPlugin());
  }
}

// We remove potentially conflicting rules that target SVGs because we use @svgr/webpack loader
// See https://github.com/nrwl/nx/issues/14383
function removeSvgLoaderIfPresent(config: Configuration) {
  const svgLoaderIdx = config.module.rules.findIndex(
    (rule) => typeof rule === 'object' && rule.test.toString().includes('svg')
  );

  if (svgLoaderIdx === -1) return;

  config.module.rules.splice(svgLoaderIdx, 1);
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

    addHotReload(config);

    if (pluginOptions?.svgr !== false) {
      removeSvgLoaderIfPresent(config);

      config.module.rules.push({
        test: /\.svg$/,
        issuer: /\.(js|ts|md)x?$/,
        use: [
          {
            loader: require.resolve('@svgr/webpack'),
            options: {
              svgo: false,
              titleProp: true,
              ref: true,
            },
          },
          {
            loader: require.resolve('file-loader'),
            options: {
              name: '[name].[hash].[ext]',
            },
          },
        ],
      });
    }

    // enable webpack node api
    config.node = {
      __dirname: true,
      __filename: true,
    };

    processed.add(config);
    return config;
  };
}
