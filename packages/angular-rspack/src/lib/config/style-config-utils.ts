import { StylePreprocessorOptions } from '@nx/angular-rspack-compiler';
import { NormalizedAngularRspackPluginOptions, SourceMap } from '../models';
import { CssExtractRspackPlugin } from '@rspack/core';

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
    test: /\.?(sa|sc)ss$/,
    use: [
      CssExtractRspackPlugin.loader,
      {
        loader: require.resolve('css-loader'),
        options: {
          url: false,
          sourceMap: sourceMap?.styles,
          importLoaders: 1,
        },
      },
      ...(sourceMap?.styles
        ? [
            {
              loader: require.resolve('resolve-url-loader'),
              options: {
                sourceMap: sourceMap?.styles,
              },
            },
          ]
        : []),
      {
        loader: 'sass-loader',
        options: {
          api: 'modern-compiler',
          sourceMap: sourceMap?.styles,
          sourceMapIncludeSources: true,
          implementation: require.resolve('sass-embedded'),
          ...(sassPathOptions ?? []),
          ...(sassOptions ?? {}),
        },
      },
    ],
  };
}

export function getLessLoaderConfig(
  lessPathOptions?: { paths?: string[] },
  sourceMap?: SourceMap
) {
  return {
    test: /\.less$/,
    use: [
      CssExtractRspackPlugin.loader,
      {
        loader: require.resolve('css-loader'),
        options: {
          url: false,
          sourceMap: sourceMap?.styles,
          importLoaders: 1,
        },
      },
      {
        loader: 'less-loader',
        options: {
          sourceMap: sourceMap?.styles,
          javascriptEnabled: true,
          ...lessPathOptions,
        },
      },
    ],
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
    {
      test: /\.css$/i,
      use: [
        CssExtractRspackPlugin.loader,
        {
          loader: require.resolve('css-loader'),
          options: {
            url: false,
            sourceMap: sourceMap?.styles,
            importLoaders: 1,
          },
        },
      ],
    },
    getSassLoaderConfig(
      sassPathOptions,
      stylePreprocessorOptions?.sass,
      sourceMap
    ),
    getLessLoaderConfig(lessPathOptions, sourceMap),
  ];
}

export function getStylesEntry(
  options: NormalizedAngularRspackPluginOptions
): string[] {
  const styles = options.globalStyles ?? [];
  const allStyleEntries: string[] = [];
  for (const style of styles) {
    for (const file of style.files) {
      allStyleEntries.push(file);
    }
  }
  return allStyleEntries;
}
