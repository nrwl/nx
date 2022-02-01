import * as path from 'path';
import { RuleSetRule } from 'webpack';

import { WebWebpackExecutorOptions } from '../../../executors/webpack/webpack.impl';
import { RemoveEmptyScriptsPlugin } from '../plugins/remove-empty-scripts-plugin';
import { getOutputHashFormat } from '../../hash-format';
import { normalizeExtraEntryPoints } from '../../normalize';
import { PostcssCliResources } from '../plugins/postcss-cli-resources';
import { RemoveHashPlugin } from '../plugins/remove-hash-plugin';
import MiniCssExtractPlugin = require('mini-css-extract-plugin');

const autoprefixer = require('autoprefixer');
const postcssImports = require('postcss-import');

const RawCssLoader = require.resolve(
  path.join(__dirname, '../plugins/raw-css-loader.js')
);

export function getStylesConfig(
  root: string,
  buildOptions: WebWebpackExecutorOptions,
  includePaths: string[]
) {
  const entryPoints: { [key: string]: string[] } = {};
  const globalStylePaths: string[] = [];
  const extraPlugins = [];

  const cssSourceMap = !!buildOptions.sourceMap;

  // Determine hashing format.
  const hashFormat = getOutputHashFormat(buildOptions.outputHashing as string);

  const postcssOptionsCreator = (sourceMap: boolean) => {
    return (loader) => ({
      map: sourceMap && {
        inline: true,
        annotation: false,
      },
      plugins: [
        postcssImports({
          addModulesDirectories: includePaths,
          resolve: (url: string) => (url.startsWith('~') ? url.substr(1) : url),
        }),
        PostcssCliResources({
          baseHref: buildOptions.baseHref,
          deployUrl: buildOptions.deployUrl,
          loader,
          filename: `[name]${hashFormat.file}.[ext]`,
        }),
        autoprefixer(),
      ],
    });
  };

  let lessPathOptions: { paths?: string[] } = {};

  if (includePaths.length > 0) {
    lessPathOptions = {
      paths: includePaths,
    };
  }

  // Process global styles.
  if (buildOptions.styles.length > 0) {
    const chunkNames: string[] = [];

    normalizeExtraEntryPoints(buildOptions.styles, 'styles').forEach(
      (style) => {
        const resolvedPath = path.resolve(root, style.input);
        // Add style entry points.
        if (entryPoints[style.bundleName]) {
          entryPoints[style.bundleName].push(resolvedPath);
        } else {
          entryPoints[style.bundleName] = [resolvedPath];
        }

        // Add non injected styles to the list.
        if (!style.inject) {
          chunkNames.push(style.bundleName);
        }

        // Add global css paths.
        globalStylePaths.push(resolvedPath);
      }
    );

    if (chunkNames.length > 0) {
      // Add plugin to remove hashes from lazy styles.
      extraPlugins.push(new RemoveHashPlugin({ chunkNames, hashFormat }));
    }
  }

  // set base rules to derive final rules from
  const baseRules: RuleSetRule[] = [
    { test: /\.css$/, use: [] },
    {
      test: /\.scss$|\.sass$/,
      use: [
        {
          loader: require.resolve('sass-loader'),
          options: {
            implementation: require('sass'),
            sourceMap: cssSourceMap,
            sassOptions: {
              fiber: false,
              // bootstrap-sass requires a minimum precision of 8
              precision: 8,
              includePaths,
            },
          },
        },
      ],
    },
    {
      test: /\.less$/,
      use: [
        {
          loader: require.resolve('less-loader'),
          options: {
            sourceMap: cssSourceMap,
            lessOptions: {
              javascriptEnabled: true,
              ...lessPathOptions,
            },
          },
        },
      ],
    },
    {
      test: /\.styl$/,
      use: [
        {
          loader: require.resolve('stylus-loader'),
          options: {
            sourceMap: cssSourceMap,
            stylusOptions: {
              include: includePaths,
            },
          },
        },
      ],
    },
  ];

  // load component css as raw strings
  const componentsSourceMap = !!(cssSourceMap &&
  // Never use component css sourcemap when style optimizations are on.
  // It will just increase bundle size without offering good debug experience.
  typeof buildOptions.optimization === 'undefined'
    ? true
    : typeof buildOptions.optimization === 'boolean'
    ? !buildOptions.optimization
    : buildOptions.optimization.styles &&
      // Inline all sourcemap types except hidden ones, which are the same as no sourcemaps
      // for component css.
      buildOptions.sourceMap !== 'hidden');

  const rules: RuleSetRule[] = baseRules.map(({ test, use }) => ({
    exclude: globalStylePaths,
    test,
    use: [
      { loader: require.resolve('raw-loader') },
      { loader: RawCssLoader },
      {
        loader: require.resolve('postcss-loader'),
        options: {
          implementation: require('postcss'),
          postcssOptions: postcssOptionsCreator(componentsSourceMap),
        },
      },
      ...(Array.isArray(use) ? use : []),
    ],
  }));

  // load global css as css files
  if (globalStylePaths.length > 0) {
    const globalSourceMap =
      !!cssSourceMap && buildOptions.sourceMap !== 'hidden';

    rules.push(
      ...baseRules.map(({ test, use }) => {
        return {
          include: globalStylePaths,
          test,
          use: [
            {
              loader: MiniCssExtractPlugin.loader,
              options: { esModule: true },
            },
            { loader: RawCssLoader },
            {
              loader: require.resolve('postcss-loader'),
              options: {
                implementation: require('postcss'),
                postcssOptions: postcssOptionsCreator(globalSourceMap),
              },
            },
            ...(use as any[]),
          ],
        };
      })
    );
  }

  extraPlugins.push(
    // extract global css from js files into own css file
    new MiniCssExtractPlugin({
      filename: `[name]${hashFormat.extract}.css`,
    }),
    // suppress empty .js files in css only entry points
    new RemoveEmptyScriptsPlugin()
  );

  return {
    entry: entryPoints,
    module: { rules },
    plugins: extraPlugins,
  };
}
