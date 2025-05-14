import * as path from 'path';
import autoprefixer = require('autoprefixer');
import postcssImports = require('postcss-import');
import { CssExtractRspackPlugin } from '@rspack/core';

import { getCSSModuleLocalIdent } from '../get-css-module-local-ident';
import { getOutputHashFormat } from '../hash-format';
import { PostcssCliResources } from '../plugins/postcss-cli-resources';

interface PostcssOptions {
  (loader: any): any;

  config?: string;
}

export function getCommonLoadersForCssModules(
  options: any,
  includePaths: string[]
) {
  // load component css as raw strings
  return [
    {
      loader: options.extractCss
        ? CssExtractRspackPlugin.loader
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
  options: any,
  includePaths: string[]
) {
  return [
    {
      loader: options.extractCss
        ? CssExtractRspackPlugin.loader
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
  options: any,
  includePaths: string[]
) {
  return [
    {
      loader: options.extractCss
        ? CssExtractRspackPlugin.loader
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
  options: any,
  {
    includePaths,
    forCssModules = false,
  }: {
    includePaths: string[];
    forCssModules?: boolean;
  }
) {
  const hashFormat = getOutputHashFormat(options.outputHashing as string);
  // PostCSS options depend on the rspack loader, but we need to set the `config` path as a string due to this check:
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
              baseHref: options.baseHref ? options.baseHref : undefined,
              deployUrl: options.deployUrl,
              loader,
              filename: `[name]${hashFormat.file}.[ext]`,
              publicPath: options.publicPath,
              rebaseRootRelative: options.rebaseRootRelative,
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
