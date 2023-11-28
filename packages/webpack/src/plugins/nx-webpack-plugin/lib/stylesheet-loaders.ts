import * as path from 'path';
import autoprefixer = require('autoprefixer');
import postcssImports = require('postcss-import');
import MiniCssExtractPlugin = require('mini-css-extract-plugin');

import { getCSSModuleLocalIdent } from '../../../utils/get-css-module-local-ident';
import { getOutputHashFormat } from '../../../utils/hash-format';
import { NormalizedNxWebpackPluginOptions } from '../nx-webpack-plugin-options';
import { PostcssCliResources } from '../../../utils/webpack/plugins/postcss-cli-resources';

interface PostcssOptions {
  (loader: any): any;

  config?: string;
}

export function getCommonLoadersForCssModules(
  options: NormalizedNxWebpackPluginOptions,
  includePaths: string[]
) {
  // load component css as raw strings
  return [
    {
      loader: options.extractCss
        ? MiniCssExtractPlugin.loader
        : require.resolve('style-loader'),
    },
    {
      loader: require.resolve('css-loader'),
      options: {
        modules: {
          mode: 'local',
          getLocalIdent: getCSSModuleLocalIdent,
        },
        importLoaders: 1,
      },
    },
    {
      loader: require.resolve('postcss-loader'),
      options: {
        implementation: require('postcss'),
        postcssOptions: postcssOptionsCreator(options, {
          includePaths,
          forCssModules: true,
        }),
      },
    },
  ];
}

export function getCommonLoadersForGlobalCss(
  options: NormalizedNxWebpackPluginOptions,
  includePaths: string[]
) {
  return [
    {
      loader: options.extractCss
        ? MiniCssExtractPlugin.loader
        : require.resolve('style-loader'),
    },
    { loader: require.resolve('css-loader'), options: { url: false } },
    {
      loader: require.resolve('postcss-loader'),
      options: {
        implementation: require('postcss'),
        postcssOptions: postcssOptionsCreator(options, {
          includePaths,
        }),
      },
    },
  ];
}

export function getCommonLoadersForGlobalStyle(
  options: NormalizedNxWebpackPluginOptions,
  includePaths: string[]
) {
  return [
    {
      loader: options.extractCss
        ? MiniCssExtractPlugin.loader
        : require.resolve('style-loader'),
      options: { esModule: true },
    },
    { loader: require.resolve('css-loader'), options: { url: false } },
    {
      loader: require.resolve('postcss-loader'),
      options: {
        implementation: require('postcss'),
        postcssOptions: postcssOptionsCreator(options, {
          includePaths,
        }),
      },
    },
  ];
}

function postcssOptionsCreator(
  options: NormalizedNxWebpackPluginOptions,
  {
    includePaths,
    forCssModules = false,
  }: {
    includePaths: string[];
    forCssModules?: boolean;
  }
) {
  const hashFormat = getOutputHashFormat(options.outputHashing as string);
  // PostCSS options depend on the webpack loader, but we need to set the `config` path as a string due to this check:
  // https://github.com/webpack-contrib/postcss-loader/blob/0d342b1/src/utils.js#L36

  const postcssOptions: PostcssOptions = (loader) => ({
    map: options.sourceMap &&
      options.sourceMap !== 'hidden' && {
        inline: true,
        annotation: false,
      },
    plugins: [
      postcssImports({
        addModulesDirectories: includePaths,
        resolve: (url: string) => (url.startsWith('~') ? url.slice(1) : url),
      }),
      ...(forCssModules
        ? []
        : [
            PostcssCliResources({
              baseHref: options.baseHref,
              deployUrl: options.deployUrl,
              loader,
              filename: `[name]${hashFormat.file}.[ext]`,
            }),
            autoprefixer(),
          ]),
    ],
  });

  // If a path to postcssConfig is passed in, set it for app and all libs, otherwise
  // use automatic detection.
  if (typeof options.postcssConfig === 'string') {
    postcssOptions.config = path.join(options.root, options.postcssConfig);
  }

  return postcssOptions;
}
