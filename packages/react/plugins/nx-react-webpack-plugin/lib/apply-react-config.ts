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

    // TODO(v20): Remove file-loader and use `?react` querystring to differentiate between asset and SVGR.
    // It should be:
    // use: [{
    //   test: /\.svg$/i,
    //   type: 'asset',
    //   resourceQuery: /react/, // *.svg?react
    // },
    // {
    //   test: /\.svg$/i,
    //   issuer: /\.[jt]sx?$/,
    //   resourceQuery: { not: [/react/] }, // exclude react component if *.svg?react
    //   use: ['@svgr/webpack'],
    // }],
    // See:
    // - SVGR: https://react-svgr.com/docs/webpack/#use-svgr-and-asset-svg-in-the-same-project
    // - Vite: https://www.npmjs.com/package/vite-plugin-svgr
    // - Rsbuild: https://github.com/web-infra-dev/rsbuild/pull/1783
    // Note: We also need a migration for any projects that are using SVGR to convert
    //       `import { ReactComponent as X } from './x.svg` to
    //       `import X from './x.svg?react';
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
    config.plugins.push(new ReactRefreshPlugin({ overlay: false }));
  }
}

// We remove potentially conflicting rules that target SVGs because we use @svgr/webpack loader
// See https://github.com/nrwl/nx/issues/14383
function removeSvgLoaderIfPresent(
  config: Partial<WebpackOptionsNormalized | Configuration>
) {
  const svgLoaderIdx = config.module.rules.findIndex(
    (rule) => typeof rule === 'object' && rule.test.toString().includes('svg')
  );
  if (svgLoaderIdx === -1) return;
  config.module.rules.splice(svgLoaderIdx, 1);
}
