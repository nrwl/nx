import { Configuration, RspackOptionsNormalized } from '@rspack/core';
import { SvgrOptions } from '../with-react';

export function applyReactConfig(
  options: { svgr?: boolean | SvgrOptions },
  config: Partial<RspackOptionsNormalized | Configuration> = {}
): void {
  if (global.NX_GRAPH_CREATION) return;

  const isDev =
    process.env.NODE_ENV === 'development' || config.mode === 'development';
  addReactBaseConfig(config, isDev);
  addHotReload(config, isDev);

  if (options.svgr !== false || typeof options.svgr === 'object') {
    removeSvgLoaderIfPresent(config);

    const defaultSvgrOptions = {
      svgo: false,
      titleProp: true,
      ref: true,
    };

    const svgrOptions =
      typeof options.svgr === 'object' ? options.svgr : defaultSvgrOptions;

    config.module.rules.push(
      {
        test: /\.svg$/i,
        type: 'asset',
        resourceQuery: /react/, // *.svg?react
      },
      {
        test: /\.svg$/i,
        issuer: /\.[jt]sx?$/,
        resourceQuery: { not: [/react/] }, // exclude react component if *.svg?react
        use: [{ loader: '@svgr/webpack', options: svgrOptions }],
      }
    );
  }

  // enable rspack node api
  config.node = {
    __dirname: true,
    __filename: true,
  };
}

function removeSvgLoaderIfPresent(
  config: Partial<RspackOptionsNormalized | Configuration>
) {
  const svgLoaderIdx = config.module.rules.findIndex(
    (rule) => typeof rule === 'object' && rule.test.toString().includes('svg')
  );
  if (svgLoaderIdx === -1) return;
  config.module.rules.splice(svgLoaderIdx, 1);
}

function addHotReload(
  config: Partial<RspackOptionsNormalized | Configuration>,
  isDev: boolean
) {
  const ReactRefreshPlugin = require('@rspack/plugin-react-refresh');

  if (isDev && config['devServer']?.hot) {
    // check if we are using babel and add the plugin
    const babelLoader = config.module.rules.find(
      (rule) =>
        rule &&
        typeof rule !== 'string' &&
        rule.loader?.toString().includes('babel-loader')
    );

    if (babelLoader && typeof babelLoader !== 'string') {
      babelLoader.options['plugins'] = [
        ...(babelLoader.options['plugins'] || []),
        isDev && [
          require.resolve('react-refresh/babel'),
          { skipEnvCheck: true },
        ],
      ].filter(Boolean);
    }
  }

  config.plugins = [
    ...(config.plugins || []),
    isDev && new ReactRefreshPlugin({ overlay: false }),
  ].filter(Boolean);
}

function addReactBaseConfig(
  config: Partial<RspackOptionsNormalized | Configuration>,
  isDev: boolean
) {
  const react = {
    runtime: 'automatic',
    development: isDev,
    refresh: isDev,
  };

  config.module.rules.push(
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
    }
  );
}
