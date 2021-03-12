import { Configuration } from 'webpack';
import { merge as mergeWebpack } from 'webpack-merge';
import * as nodeExternals from 'webpack-node-externals';

import { getBaseWebpackPartial } from './config';
import { BuildNodeBuilderOptions } from './types';

function getNodePartial(options: BuildNodeBuilderOptions) {
  const webpackConfig: Configuration = {
    output: {
      libraryTarget: 'commonjs',
    },
    target: 'node',
    node: false,
  };

  if (options.optimization) {
    webpackConfig.optimization = {
      minimize: false,
      concatenateModules: false,
    };
  }

  if (options.externalDependencies === 'all') {
    webpackConfig.externals = [nodeExternals()];
  } else if (Array.isArray(options.externalDependencies)) {
    // TODO New webpack typings don't agree with this funtion format.
    //   The code works, however.  This should be investigated.
    //   Webpack types for externals: https://github.com/webpack/webpack/blob/e643b85a6accde7e4c7f19c8770816e5aaf6a945/types.d.ts#L1888
    // @ts-ignore
    webpackConfig.externals = [
      function (_context, request, callback: Function) {
        console.log(_context);
        console.log(request);
        console.log(callback);
        if (options.externalDependencies.includes(request)) {
          // not bundled
          console.log(`>>>> NOT BUNDLED`);
          return callback(null, 'commonjs ' + request);
        }
        // bundled
        callback();
      },
    ];
  }
  return webpackConfig;
}

export function getNodeWebpackConfig(options: BuildNodeBuilderOptions) {
  return mergeWebpack([
    getBaseWebpackPartial(options),
    getNodePartial(options),
  ]) as Configuration;
}
