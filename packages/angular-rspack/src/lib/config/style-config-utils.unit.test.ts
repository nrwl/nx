import { describe } from 'vitest';
import {
  getIncludePathOptions,
  getLessLoaderConfig,
  getSassLoaderConfig,
  getStyleLoaders,
} from './style-config-utils';
import { CssExtractRspackPlugin } from '@rspack/core';

describe('getIncludePathOptions', () => {
  it('should return empty object if includePaths is not provided', () => {
    expect(getIncludePathOptions()).toStrictEqual({ less: {}, sass: {} });
  });

  it('should return empty object if includePaths is empty', () => {
    expect(getIncludePathOptions([])).toStrictEqual({ less: {}, sass: {} });
  });

  it('should return paths for less if includePaths is provided', () => {
    expect(getIncludePathOptions(['path/to/a'])).toStrictEqual(
      expect.objectContaining({
        less: { paths: ['path/to/a'] },
      })
    );
  });

  it('should return includePaths for sass if includePaths is provided', () => {
    expect(getIncludePathOptions(['path/to/a'])).toStrictEqual(
      expect.objectContaining({
        sass: { includePaths: ['path/to/a'] },
      })
    );
  });

  it('should return multiple paths', () => {
    expect(getIncludePathOptions(['path/to/a', 'path/to/b'])).toStrictEqual(
      expect.objectContaining({
        sass: { includePaths: ['path/to/a', 'path/to/b'] },
      })
    );
  });
});

describe('getSassLoaderConfig', () => {
  it('should return sass loader config without options passed', () => {
    expect(getSassLoaderConfig()).toStrictEqual({
      test: /\.?(sa|sc)ss$/,
      use: expect.arrayContaining([
        expect.objectContaining({
          loader: require.resolve('css-loader'),
          options: {
            url: false,
            sourceMap: undefined,
            importLoaders: 1,
          },
        }),
        {
          loader: 'sass-loader',
          options: {
            api: 'modern-compiler',
            implementation: require.resolve('sass-embedded'),
            sourceMap: undefined,
            sourceMapIncludeSources: true,
          },
        },
      ]),
    });
  });

  it('should return sass loader config with sassPathOptions', () => {
    expect(
      getSassLoaderConfig({ includePaths: ['path/to/sass'] })
    ).toStrictEqual(
      expect.objectContaining({
        use: expect.arrayContaining([
          expect.objectContaining({
            options: expect.objectContaining({
              includePaths: ['path/to/sass'],
              sourceMap: undefined,
              sourceMapIncludeSources: true,
            }),
          }),
        ]),
      })
    );
  });

  it('should return sass loader config with sassOptions', () => {
    expect(
      getSassLoaderConfig(undefined, { indentedSyntax: true })
    ).toStrictEqual(
      expect.objectContaining({
        use: expect.arrayContaining([
          expect.objectContaining({
            options: expect.objectContaining({
              indentedSyntax: true,
            }),
          }),
        ]),
      })
    );
  });
});

describe('getLessLoaderConfig', () => {
  it('should return less loader config without options passed', () => {
    expect(getLessLoaderConfig()).toStrictEqual({
      test: /\.less$/,
      use: expect.arrayContaining([
        expect.objectContaining({
          loader: require.resolve('css-loader'),
          options: {
            url: false,
            sourceMap: undefined,
            importLoaders: 1,
          },
        }),
        {
          loader: 'less-loader',
          options: {
            javascriptEnabled: true,
            sourceMap: undefined,
          },
        },
      ]),
    });
  });

  it('should return less loader config with lessPathOptions', () => {
    expect(getLessLoaderConfig({ paths: ['path/to/less'] })).toStrictEqual(
      expect.objectContaining({
        use: expect.arrayContaining([
          expect.objectContaining({
            options: expect.objectContaining({
              paths: ['path/to/less'],
            }),
          }),
        ]),
      })
    );
  });
});

describe('getStyleLoaders', () => {
  it('should return sass and less loader config without options passed', () => {
    expect(getStyleLoaders()).toStrictEqual([
      {
        test: /\.css$/i,
        use: [
          CssExtractRspackPlugin.loader,
          {
            loader: require.resolve('css-loader'),
            options: {
              url: false,
              sourceMap: undefined,
              importLoaders: 1,
            },
          },
        ],
      },
      {
        test: /\.?(sa|sc)ss$/,
        use: expect.arrayContaining([
          {
            loader: 'sass-loader',
            options: {
              api: 'modern-compiler',
              implementation: require.resolve('sass-embedded'),
              sourceMap: undefined,
              sourceMapIncludeSources: true,
            },
          },
        ]),
      },
      {
        test: /\.less$/,
        use: expect.arrayContaining([
          {
            loader: 'less-loader',
            options: {
              javascriptEnabled: true,
              sourceMap: undefined,
            },
          },
        ]),
      },
    ]);
  });

  it('should return sass and less loader config with options', () => {
    expect(
      getStyleLoaders({
        includePaths: ['path/to/a'],
        sass: { indentedSyntax: true },
      })
    ).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          use: expect.arrayContaining([
            expect.objectContaining({
              options: expect.objectContaining({
                includePaths: ['path/to/a'],
                indentedSyntax: true,
              }),
            }),
          ]),
        }),
        expect.objectContaining({
          use: expect.arrayContaining([
            expect.objectContaining({
              options: expect.objectContaining({
                paths: ['path/to/a'],
              }),
            }),
          ]),
        }),
      ])
    );
  });
});
