import { StylePreprocessorOptions } from '@nx/angular-rspack-compiler';
import { SourceMap } from '../models';

export function getIncludePathOptions(includePaths?: string[]) {
  if (!includePaths || includePaths.length === 0) {
    return { less: {}, sass: {} };
  }

  return {
    less: { paths: includePaths },
    sass: { includePaths },
  };
}

export function getSassLoaderConfig(
  sassPathOptions?: { includePaths?: string[] },
  sassOptions?: StylePreprocessorOptions['sass'],
  sourceMap?: SourceMap
) {
  return {
    test: /\.?(sa|sc|c)ss$/,
    use: [
      {
        loader: 'sass-loader',
        options: {
          api: 'modern-compiler',
          sourceMap: sourceMap?.styles,
          implementation: require.resolve('sass-embedded'),
          ...(sassPathOptions ?? []),
          ...(sassOptions ?? {}),
        },
      },
    ],
    type: 'css/auto',
  };
}

export function getLessLoaderConfig(
  lessPathOptions?: { paths?: string[] },
  sourceMap?: SourceMap
) {
  return {
    test: /\.less$/,
    use: [
      {
        loader: 'less-loader',
        options: {
          sourceMap: sourceMap?.styles,
          javascriptEnabled: true,
          ...lessPathOptions,
        },
      },
    ],
    type: 'css/auto',
  };
}

/**
 * Returns an array of style loaders for sass and less. Both loader´s are always returned
 *
 * @param stylePreprocessorOptions
 * @param sourceMap
 */
export function getStyleLoaders(
  stylePreprocessorOptions?: StylePreprocessorOptions,
  sourceMap?: SourceMap
) {
  const { less: lessPathOptions, sass: sassPathOptions } =
    getIncludePathOptions(stylePreprocessorOptions?.includePaths);

  return [
    getSassLoaderConfig(
      sassPathOptions,
      stylePreprocessorOptions?.sass,
      sourceMap
    ),
    getLessLoaderConfig(lessPathOptions, sourceMap),
  ];
}
