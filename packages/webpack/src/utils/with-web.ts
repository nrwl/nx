import * as webpack from 'webpack';
import {
  Configuration,
  ids,
  RuleSetRule,
  WebpackPluginInstance,
} from 'webpack';
import { SubresourceIntegrityPlugin } from 'webpack-subresource-integrity';
import * as path from 'path';
import { getOutputHashFormat } from '@nrwl/webpack/src/utils/hash-format';
import { PostcssCliResources } from '@nrwl/webpack/src/utils/webpack/plugins/postcss-cli-resources';
import { normalizeExtraEntryPoints } from '@nrwl/webpack/src/utils/webpack/normalize-entry';

import { NormalizedWebpackExecutorOptions } from '../executors/webpack/schema';
import { getClientEnvironment } from './get-client-environment';
import { ScriptsWebpackPlugin } from './webpack/plugins/scripts-webpack-plugin';
import { getCSSModuleLocalIdent } from './get-css-module-local-ident';
import CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
import MiniCssExtractPlugin = require('mini-css-extract-plugin');
import autoprefixer = require('autoprefixer');
import postcssImports = require('postcss-import');
import { basename } from 'path';

interface PostcssOptions {
  (loader: any): any;

  config?: string;
}

export function withWeb() {
  return function configure(
    config: Configuration,
    { options }: { options: NormalizedWebpackExecutorOptions }
  ): Configuration {
    const plugins = [];

    const stylesOptimization =
      typeof options.optimization === 'object'
        ? options.optimization.styles
        : options.optimization;

    if (Array.isArray(options.scripts)) {
      plugins.push(...createScriptsPlugin(options));
    }

    if (options.subresourceIntegrity) {
      plugins.push(new SubresourceIntegrityPlugin());
    }

    const minimizer: WebpackPluginInstance[] = [
      new ids.HashedModuleIdsPlugin(),
    ];
    if (stylesOptimization) {
      minimizer.push(
        new CssMinimizerPlugin({
          test: /\.(?:css|scss|sass|less|styl)$/,
        })
      );
    }
    plugins.push(
      new webpack.DefinePlugin(
        getClientEnvironment(process.env.NODE_ENV).stringified
      )
    );

    const entry: { [key: string]: string[] } = {};
    const globalStylePaths: string[] = [];

    // Determine hashing format.
    const hashFormat = getOutputHashFormat(options.outputHashing as string);

    const includePaths: string[] = [];
    if (options?.stylePreprocessorOptions?.includePaths?.length > 0) {
      options.stylePreprocessorOptions.includePaths.forEach(
        (includePath: string) =>
          includePaths.push(path.resolve(options.root, includePath))
      );
    }

    let lessPathOptions: { paths?: string[] } = {};

    if (includePaths.length > 0) {
      lessPathOptions = {
        paths: includePaths,
      };
    }

    // Process global styles.
    if (options.styles.length > 0) {
      normalizeExtraEntryPoints(options.styles, 'styles').forEach((style) => {
        const resolvedPath = path.resolve(options.root, style.input);
        // Add style entry points.
        if (entry[style.bundleName]) {
          entry[style.bundleName].push(resolvedPath);
        } else {
          entry[style.bundleName] = [resolvedPath];
        }

        // Add global css paths.
        globalStylePaths.push(resolvedPath);
      });
    }

    const cssModuleRules: RuleSetRule[] = [
      {
        test: /\.module\.css$/,
        use: getCommonLoadersForCssModules(options, includePaths),
      },
      {
        test: /\.module\.(scss|sass)$/,
        use: [
          ...getCommonLoadersForCssModules(options, includePaths),
          {
            loader: require.resolve('sass-loader'),
            options: {
              implementation: require('sass'),
              sassOptions: {
                fiber: false,
                precision: 8,
                includePaths,
              },
            },
          },
        ],
      },
      {
        test: /\.module\.less$/,
        use: [
          ...getCommonLoadersForCssModules(options, includePaths),
          {
            loader: require.resolve('less-loader'),
            options: {
              lessOptions: {
                paths: includePaths,
              },
            },
          },
        ],
      },
      {
        test: /\.module\.styl$/,
        use: [
          ...getCommonLoadersForCssModules(options, includePaths),
          {
            loader: require.resolve('stylus-loader'),
            options: {
              stylusOptions: {
                include: includePaths,
              },
            },
          },
        ],
      },
    ];

    const globalCssRules: RuleSetRule[] = [
      {
        test: /\.css$/,
        use: getCommonLoadersForGlobalCss(options, includePaths),
      },
      {
        test: /\.scss$|\.sass$/,
        use: [
          ...getCommonLoadersForGlobalCss(options, includePaths),
          {
            loader: require.resolve('sass-loader'),
            options: {
              implementation: require('sass'),
              sourceMap: options.sourceMap,
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
          ...getCommonLoadersForGlobalCss(options, includePaths),
          {
            loader: require.resolve('less-loader'),
            options: {
              sourceMap: options.sourceMap,
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
          ...getCommonLoadersForGlobalCss(options, includePaths),
          {
            loader: require.resolve('stylus-loader'),
            options: {
              sourceMap: options.sourceMap,
              stylusOptions: {
                include: includePaths,
              },
            },
          },
        ],
      },
    ];

    const rules: RuleSetRule[] = [
      {
        test: /\.css$|\.scss$|\.sass$|\.less$|\.styl$/,
        oneOf: [
          ...cssModuleRules,
          ...globalCssRules,
          // load global css as css files
          {
            test: /\.css$|\.scss$|\.sass$|\.less$|\.styl$/,
            include: globalStylePaths,
            use: [
              {
                loader: MiniCssExtractPlugin.loader,
                options: { esModule: true },
              },
              { loader: require.resolve('css-loader') },
              {
                loader: require.resolve('postcss-loader'),
                options: {
                  implementation: require('postcss'),
                  postcssOptions: postcssOptionsCreator(options, includePaths),
                },
              },
            ],
          },
        ],
      },
    ];

    plugins.push(
      // extract global css from js files into own css file
      new MiniCssExtractPlugin({
        filename: `[name]${hashFormat.extract}.css`,
      })
    );

    // context needs to be set for babel to pick up correct babelrc
    config.context = path.join(options.root, options.projectRoot);

    config.output = {
      ...config.output,
      crossOriginLoading: options.subresourceIntegrity
        ? ('anonymous' as const)
        : (false as const),
    };

    // In case users customize their webpack config with unsupported entry.
    if (typeof config.entry === 'function')
      throw new Error('Entry function is not supported. Use an object.');
    if (typeof config.entry === 'string')
      throw new Error('Entry string is not supported. Use an object.');
    if (Array.isArray(config.entry))
      throw new Error('Entry array is not supported. Use an object.');

    config.entry = { ...config.entry, ...entry };

    config.optimization = {
      ...config.optimization,
      minimizer,
      emitOnErrors: false,
      moduleIds: 'deterministic' as const,
      runtimeChunk: options.runtimeChunk ? ('single' as const) : false,
      splitChunks: {
        maxAsyncRequests: Infinity,
        cacheGroups: {
          default: !!options.commonChunk && {
            chunks: 'async' as const,
            minChunks: 2,
            priority: 10,
          },
          common: !!options.commonChunk && {
            name: 'common',
            chunks: 'async' as const,
            minChunks: 2,
            enforce: true,
            priority: 5,
          },
          vendors: false as const,
          vendor: !!options.vendorChunk && {
            name: 'vendor',
            chunks: (chunk) => chunk.name === 'main',
            enforce: true,
            test: /[\\/]node_modules[\\/]/,
          },
        },
      },
    };

    config.plugins.push(...plugins);

    config.module = {
      ...config.module,
      rules: [
        ...config.module.rules,
        ...rules,
        {
          test: /\.(bmp|png|jpe?g|gif|webp|avif)$/,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 10_000, // 10 kB
            },
          },
        },
        {
          test: /\.(eot|svg|cur|jpg|png|webp|gif|otf|ttf|woff|woff2|ani)$/,
          loader: require.resolve('file-loader'),
          options: {
            name: `[name]${hashFormat.file}.[ext]`,
          },
        },
      ],
    };
    return config;
  };
}

function createScriptsPlugin(
  options: NormalizedWebpackExecutorOptions
): WebpackPluginInstance[] {
  // process global scripts
  const globalScriptsByBundleName = normalizeExtraEntryPoints(
    options.scripts || [],
    'scripts'
  ).reduce(
    (
      prev: { inject: boolean; bundleName: string; paths: string[] }[],
      curr
    ) => {
      const bundleName = curr.bundleName;
      const resolvedPath = path.resolve(options.root, curr.input);
      const existingEntry = prev.find((el) => el.bundleName === bundleName);
      if (existingEntry) {
        existingEntry.paths.push(resolvedPath);
      } else {
        prev.push({
          inject: curr.inject,
          bundleName,
          paths: [resolvedPath],
        });
      }

      return prev;
    },
    []
  );

  const hashFormat = getOutputHashFormat(options.outputHashing as string);
  const plugins = [];
  // Add a new asset for each entry.
  globalScriptsByBundleName.forEach((script) => {
    const hash = script.inject ? hashFormat.script : '';
    const bundleName = script.bundleName;

    plugins.push(
      new ScriptsWebpackPlugin({
        name: bundleName,
        sourceMap: !!options.sourceMap,
        filename: `${basename(bundleName)}${hash}.js`,
        scripts: script.paths,
        basePath: options.sourceRoot,
      })
    );
  });

  return plugins;
}

function getCommonLoadersForCssModules(
  options: NormalizedWebpackExecutorOptions,
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
        postcssOptions: postcssOptionsCreator(options, includePaths),
      },
    },
  ];
}

function getCommonLoadersForGlobalCss(
  options: NormalizedWebpackExecutorOptions,
  includePaths: string[]
) {
  return [
    {
      loader: options.extractCss
        ? MiniCssExtractPlugin.loader
        : require.resolve('style-loader'),
    },
    { loader: require.resolve('css-loader') },
    {
      loader: require.resolve('postcss-loader'),
      options: {
        implementation: require('postcss'),
        postcssOptions: postcssOptionsCreator(options, includePaths),
      },
    },
  ];
}

function postcssOptionsCreator(
  options: NormalizedWebpackExecutorOptions,
  includePaths: string[]
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
      PostcssCliResources({
        baseHref: options.baseHref,
        deployUrl: options.deployUrl,
        loader,
        filename: `[name]${hashFormat.file}.[ext]`,
      }),
      autoprefixer(),
    ],
  });

  // If a path to postcssConfig is passed in, set it for app and all libs, otherwise
  // use automatic detection.
  if (typeof options.postcssConfig === 'string') {
    postcssOptions.config = path.join(options.root, options.postcssConfig);
  }

  return postcssOptions;
}
