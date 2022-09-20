import { LicenseWebpackPlugin } from 'license-webpack-plugin';
import { ids } from 'webpack';
import { SubresourceIntegrityPlugin } from 'webpack-subresource-integrity';
import { CreateWebpackConfigOptions } from '../../models';
import CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

export function getBrowserConfig(wco: CreateWebpackConfigOptions) {
  const { buildOptions, supportES2015 } = wco;
  const extraPlugins = [];

  const stylesOptimization =
    typeof buildOptions.optimization === 'object'
      ? buildOptions.optimization.styles
      : buildOptions.optimization;

  if (buildOptions.subresourceIntegrity) {
    extraPlugins.push(new SubresourceIntegrityPlugin());
  }

  if (buildOptions.extractLicenses) {
    extraPlugins.push(
      new LicenseWebpackPlugin({
        stats: {
          warnings: false,
          errors: false,
        },
        perChunkOutput: false,
        outputFilename: `3rdpartylicenses.txt`,
      })
    );
  }

  const extraMinimizers = [];
  if (stylesOptimization) {
    extraMinimizers.push(
      new CssMinimizerPlugin({
        test: /\.(?:css|scss|sass|less|styl)$/,
      })
    );
  }

  return {
    resolve: {
      mainFields: [
        ...(supportES2015 ? ['es2015'] : []),
        'browser',
        'module',
        'main',
      ],
    },
    output: {
      crossOriginLoading: buildOptions.subresourceIntegrity
        ? ('anonymous' as const)
        : (false as const),
    },
    // context needs to be set for babel to pick up correct babelrc
    context: wco.projectRoot,
    optimization: {
      minimizer: [new ids.HashedModuleIdsPlugin(), ...extraMinimizers],
      emitOnErrors: false,
      moduleIds: 'deterministic' as const,
      runtimeChunk: buildOptions.runtimeChunk ? ('single' as const) : false,
      splitChunks: {
        maxAsyncRequests: Infinity,
        cacheGroups: {
          default: !!buildOptions.commonChunk && {
            chunks: 'async' as const,
            minChunks: 2,
            priority: 10,
          },
          common: !!buildOptions.commonChunk && {
            name: 'common',
            chunks: 'async' as const,
            minChunks: 2,
            enforce: true,
            priority: 5,
          },
          vendors: false as const,
          vendor: !!buildOptions.vendorChunk && {
            name: 'vendor',
            chunks: (chunk) => chunk.name === 'main',
            enforce: true,
            test: /[\\/]node_modules[\\/]/,
          },
        },
      },
    },
    plugins: extraPlugins,
    node: false as false,
  };
}
