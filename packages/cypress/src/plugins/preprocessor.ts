import * as wp from '@cypress/webpack-preprocessor';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
import { stripIndents } from '@nrwl/devkit';
import { installedCypressVersion } from '@nrwl/cypress/src/utils/cypress-version';
import nodeExternals = require('webpack-node-externals');

/**
 * @deprecated This function is no longer necessary and will be removed in Nx 14
 */
export function preprocessTypescript(
  config: any,
  customizeWebpackConfig?: (webpackConfig: any) => any
) {
  if (installedCypressVersion() >= 7) {
    console.log(stripIndents`
    preprocessTypescript is now deprecated since Cypress has added typescript support.
    If you would still like preprocess files with webpack, use the "@cypress/webpack-preprocessor" package.`);
  }

  if (!config.env.tsConfig) {
    throw new Error(
      'Please provide an absolute path to a tsconfig.json as cypressConfig.env.tsConfig'
    );
  }

  return async (file) => {
    const webpackOptions = customizeWebpackConfig
      ? customizeWebpackConfig(getWebpackConfig(config))
      : getWebpackConfig(config);
    return wp({ webpackOptions })(file);
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
          test: /\.([jt])sx?$/,
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
        typescript: {
          enabled: true,
          configFile: config.env.tsConfig,
        },
      }),
    ],
    externals: [nodeExternals()],
  };
}
