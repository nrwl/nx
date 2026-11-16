import { AssetGlobPattern } from '../executors/webpack/schema';

export function createCopyPlugin(assets: AssetGlobPattern[]) {
  const CopyWebpackPlugin =
    require('copy-webpack-plugin') as typeof import('copy-webpack-plugin');

  return new CopyWebpackPlugin({
    patterns: assets.map((asset) => {
      return {
        context: asset.input,
        // Now we remove starting slash to make Webpack place it from the output root.
        to: asset.output,
        from: asset.glob,
        globOptions: {
          ignore: [
            '.gitkeep',
            '**/.DS_Store',
            '**/Thumbs.db',
            ...(asset.ignore ?? []),
          ],
          dot: true,
        },
        noErrorOnMissing: true,
      };
    }),
  });
}
