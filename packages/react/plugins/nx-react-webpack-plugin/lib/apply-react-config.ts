import { Configuration, WebpackOptionsNormalized } from 'webpack';

export function applyReactConfig(
  options: Record<string, any> = {},
  config: Partial<WebpackOptionsNormalized | Configuration> = {}
): void {
  if (!process.env['NX_TASK_TARGET_PROJECT']) return;

  addHotReload(config);

  // enable webpack node api
  config.node = {
    __dirname: true,
    __filename: true,
  };
}

function addHotReload(
  config: Partial<WebpackOptionsNormalized | Configuration>
) {
  const devServer = 'devServer' in config ? config.devServer : undefined;
  if (
    config.mode === 'development' &&
    typeof devServer === 'object' &&
    devServer !== null &&
    'hot' in devServer &&
    devServer.hot
  ) {
    // add `react-refresh/babel` to babel loader plugin
    const babelLoader = config.module?.rules?.find(
      (rule) =>
        rule &&
        typeof rule !== 'string' &&
        rule.loader?.toString().includes('babel-loader')
    );

    const babelOptions =
      babelLoader && typeof babelLoader !== 'string'
        ? babelLoader.options
        : undefined;
    if (babelOptions && typeof babelOptions !== 'string') {
      babelOptions['plugins'] = [
        ...(babelOptions['plugins'] || []),
        [
          require.resolve('react-refresh/babel'),
          {
            skipEnvCheck: true,
          },
        ],
      ];
    }

    const ReactRefreshPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
    (config.plugins ??= []).push(new ReactRefreshPlugin({ overlay: false }));
  }
}
