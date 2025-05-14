import { Configuration, WebpackOptionsNormalized } from 'webpack';
import { SvgrOptions } from '../../with-react';

export function applyReactConfig(
  options: { svgr?: boolean | SvgrOptions },
  config: Partial<WebpackOptionsNormalized | Configuration> = {}
): void {
  if (!process.env['NX_TASK_TARGET_PROJECT']) return;

  addHotReload(config);

  if (options.svgr !== false || typeof options.svgr === 'object') {
    removeSvgLoaderIfPresent(config);

    const defaultSvgrOptions = {
      svgo: false,
      titleProp: true,
      ref: true,
    };

    const svgrOptions =
      typeof options.svgr === 'object' ? options.svgr : defaultSvgrOptions;

    config.module.rules.push({
      test: /\.svg$/,
      issuer: /\.(js|ts|md)x?$/,
      use: [
        {
          loader: require.resolve('@svgr/webpack'),
          options: svgrOptions,
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
}

function addHotReload(
  config: Partial<WebpackOptionsNormalized | Configuration>
) {
  if (
    config.mode === 'development' &&
    typeof config['devServer'] === 'object' &&
    config['devServer']?.hot
  ) {
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
    config.plugins.push(new ReactRefreshPlugin({ overlay: false }));
  }
}

// We remove potentially conflicting rules that target SVGs because we use @svgr/webpack loader
// See https://github.com/nrwl/nx/issues/14383
function removeSvgLoaderIfPresent(
  config: Partial<WebpackOptionsNormalized | Configuration>
) {
  const svgLoaderIdx = config.module.rules.findIndex(
    (rule) =>
      typeof rule === 'object' &&
      typeof rule.test !== 'undefined' &&
      rule.test.toString().includes('svg')
  );
  if (svgLoaderIdx === -1) return;
  config.module.rules.splice(svgLoaderIdx, 1);
}
