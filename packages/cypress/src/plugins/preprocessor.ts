import * as wp from '@cypress/webpack-preprocessor';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import * as nodeExternals from 'webpack-node-externals';
import * as ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';

export function preprocessTypescript(
  config: any,
  customizeWebpackConfig?: (webpackConfig: any) => any
) {
  if (!config.env.tsConfig) {
    throw new Error(
      'Please provide an absolute path to a tsconfig.json as cypressConfig.env.tsConfig'
    );
  }

  return async (...args) => {
    const webpackOptions = customizeWebpackConfig
      ? customizeWebpackConfig(getWebpackConfig(config))
      : getWebpackConfig(config);
    return wp({ webpackOptions })(...args);
  };
}

export function getWebpackConfig(config: any) {
  const extensions = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];
  return {
    resolve: {
      extensions,
      plugins: [
        new TsconfigPathsPlugin({
          configFile: config.env.tsConfig,
          extensions,
        }),
      ],
    },
    module: {
      rules: [
        {
          test: /\.(j|t)sx?$/,
          loader: require.resolve('ts-loader'),
          exclude: [/node_modules/],
          options: {
            configFile: config.env.tsConfig,
            // https://github.com/TypeStrong/ts-loader/pull/685
            experimentalWatchApi: true,
            transpileOnly: true,
          },
        },
      ],
    },
    plugins: [
      new ForkTsCheckerWebpackPlugin({
        tsconfig: config.env.tsConfig,
        useTypescriptIncrementalApi: false,
      }),
    ],
    externals: [nodeExternals()],
  };
}
