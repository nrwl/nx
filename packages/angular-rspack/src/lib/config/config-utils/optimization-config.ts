import {
  LightningCssMinimizerRspackPlugin,
  SwcJsMinimizerRspackPlugin,
  Configuration,
} from '@rspack/core';
import { NormalizedAngularRspackPluginOptions } from '../../models';
import { TransferSizePlugin } from '../../plugins/transfer-size-plugin';

export const VENDORS_TEST = /[\\/]node_modules[\\/]/;

export function getOptimization(
  normalizedOptions: NormalizedAngularRspackPluginOptions,
  platform: 'browser' | 'server'
): Configuration['optimization'] {
  return {
    chunkIds: normalizedOptions.namedChunks ? 'named' : 'deterministic',
    emitOnErrors: false,
    moduleIds: 'deterministic',
    runtimeChunk: platform === 'browser' ? 'single' : false,
    minimizer: normalizedOptions.optimization.scripts
      ? [
          new SwcJsMinimizerRspackPlugin({
            minimizerOptions: {
              minify: true,
              ...(platform === 'server'
                ? {
                    mangle: {
                      reserved: [
                        'renderApplication',
                        'renderModule',
                        'ɵSERVER_CONTEXT',
                        'ɵgetRoutesFromAngularRouterConfig',
                      ],
                    },
                  }
                : {}),
              format: {
                comments: false,
              },
            },
          }),
          new LightningCssMinimizerRspackPlugin(),
          ...(platform === 'browser' ? [new TransferSizePlugin()] : []),
        ]
      : [],
    splitChunks: {
      chunks: platform === 'browser' ? 'all' : 'async',
      minChunks: 1,
      minSize: 20000,
      maxAsyncRequests: 30,
      maxInitialRequests: 30,
      cacheGroups: {
        default: normalizedOptions.commonChunk && {
          chunks: 'async',
          minChunks: 2,
          priority: 10,
        },
        common: normalizedOptions.commonChunk && {
          name: 'common',
          chunks: 'async',
          minChunks: 2,
          enforce: true,
          priority: 5,
        },
        vendors: false,
        defaultVendors: normalizedOptions.vendorChunk && {
          name: 'vendor',
          chunks: (chunk) => chunk.name === 'main',
          enforce: true,
          test: VENDORS_TEST,
        },
      },
    },
  };
}
