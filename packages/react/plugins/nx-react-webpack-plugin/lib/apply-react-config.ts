import { Configuration, WebpackOptionsNormalized } from 'webpack';

export function applyReactConfig(
  options: { svgr?: boolean },
  config: Partial<WebpackOptionsNormalized | Configuration> = {}
): void {
  if (!process.env['NX_TASK_TARGET_PROJECT']) return;

  addHotReload(config);

  if (options.svgr !== false) {
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
    config.plugins.push(new ReactRefreshPlugin());
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
