import { StylePreprocessorOptions } from '@ng-rspack/compiler';

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
  sassOptions?: StylePreprocessorOptions['sass']
) {
  return {
    test: /\.?(sa|sc|c)ss$/,
    use: [
      {
        loader: 'sass-loader',
        options: {
          api: 'modern-compiler',
          implementation: require.resolve('sass-embedded'),
          ...(sassPathOptions ?? []),
          ...(sassOptions ?? {}),
        },
      },
    ],
    type: 'css/auto',
  };
}

export function getLessLoaderConfig(lessPathOptions?: { paths?: string[] }) {
  return {
    test: /\.less$/,
    use: [
      {
        loader: 'less-loader',
        options: {
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
 */
export function getStyleLoaders(
  stylePreprocessorOptions?: StylePreprocessorOptions
) {
  const { less: lessPathOptions, sass: sassPathOptions } =
    getIncludePathOptions(stylePreprocessorOptions?.includePaths);

  return [
    getSassLoaderConfig(sassPathOptions, stylePreprocessorOptions?.sass),
    getLessLoaderConfig(lessPathOptions),
  ];
}
