import * as webpack from 'webpack';
import {
  Configuration,
  ids,
  RuleSetRule,
  WebpackPluginInstance,
} from 'webpack';
import { SubresourceIntegrityPlugin } from 'webpack-subresource-integrity';
import * as path from 'path';
import { basename, join } from 'path';
import { getOutputHashFormat } from './hash-format';
import { PostcssCliResources } from './webpack/plugins/postcss-cli-resources';
import { normalizeExtraEntryPoints } from './webpack/normalize-entry';

import { NxWebpackExecutionContext, NxWebpackPlugin } from './config';
import {
  ExtraEntryPointClass,
  NormalizedWebpackExecutorOptions,
} from '../executors/webpack/schema';
import { getClientEnvironment } from './get-client-environment';
import { ScriptsWebpackPlugin } from './webpack/plugins/scripts-webpack-plugin';
import { getCSSModuleLocalIdent } from './get-css-module-local-ident';
import { WriteIndexHtmlPlugin } from '../plugins/write-index-html-plugin';
import CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
import MiniCssExtractPlugin = require('mini-css-extract-plugin');
import autoprefixer = require('autoprefixer');
import postcssImports = require('postcss-import');

interface PostcssOptions {
  (loader: any): any;

  config?: string;
}

const processed = new Set();

export interface WithWebOptions {
  baseHref?: string;
  crossOrigin?: 'none' | 'anonymous' | 'use-credentials';
  deployUrl?: string;
  extractCss?: boolean;
  generateIndexHtml?: boolean;
  index?: string;
  postcssConfig?: string;
  scripts?: Array<ExtraEntryPointClass | string>;
  stylePreprocessorOptions?: any;
  styles?: Array<ExtraEntryPointClass | string>;
  subresourceIntegrity?: boolean;
  ssr?: boolean;
}

// Omit deprecated options
export type MergedOptions = Omit<
  NormalizedWebpackExecutorOptions,
  keyof WithWebOptions
> &
  WithWebOptions;

/**
 * @param {WithWebOptions} pluginOptions
 * @returns {NxWebpackPlugin}
 */
export function withWeb(pluginOptions: WithWebOptions = {}): NxWebpackPlugin {
  return function configure(
    config: Configuration,
    { options: executorOptions, context }: NxWebpackExecutionContext
  ): Configuration {
    if (processed.has(config)) return config;

    const mergedOptions: MergedOptions = {
      ...executorOptions,
      ...pluginOptions,
    };
    const plugins = [];

    const stylesOptimization =
      typeof mergedOptions.optimization === 'object'
        ? mergedOptions.optimization.styles
        : mergedOptions.optimization;

    if (Array.isArray(mergedOptions.scripts)) {
      plugins.push(...createScriptsPlugin(mergedOptions));
    }
    if (mergedOptions.index && mergedOptions.generateIndexHtml) {
      plugins.push(
        new WriteIndexHtmlPlugin({
          crossOrigin: mergedOptions.crossOrigin,
          sri: mergedOptions.subresourceIntegrity,
          outputPath: basename(mergedOptions.index),
          indexPath: join(context.root, mergedOptions.index),
          baseHref: mergedOptions.baseHref,
          deployUrl: mergedOptions.deployUrl,
          scripts: mergedOptions.scripts,
          styles: mergedOptions.styles,
        })
      );
    }

    if (mergedOptions.subresourceIntegrity) {
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
    if (!pluginOptions.ssr) {
      plugins.push(
        new webpack.DefinePlugin(
          getClientEnvironment(process.env.NODE_ENV).stringified
        )
      );
    }

    const entry: { [key: string]: string[] } = {};
    const globalStylePaths: string[] = [];

    // Determine hashing format.
    const hashFormat = getOutputHashFormat(
      mergedOptions.outputHashing as string
    );

    const includePaths: string[] = [];
    if (mergedOptions?.stylePreprocessorOptions?.includePaths?.length > 0) {
      mergedOptions.stylePreprocessorOptions.includePaths.forEach(
        (includePath: string) =>
          includePaths.push(path.resolve(mergedOptions.root, includePath))
      );
    }

    let lessPathOptions: { paths?: string[] } = {};

    if (includePaths.length > 0) {
      lessPathOptions = {
        paths: includePaths,
      };
    }

    // Process global styles.
    if (mergedOptions.styles.length > 0) {
      normalizeExtraEntryPoints(mergedOptions.styles, 'styles').forEach(
        (style) => {
          const resolvedPath = path.resolve(mergedOptions.root, style.input);
          // Add style entry points.
          if (entry[style.bundleName]) {
            entry[style.bundleName].push(resolvedPath);
          } else {
            entry[style.bundleName] = [resolvedPath];
          }

          // Add global css paths.
          globalStylePaths.push(resolvedPath);
        }
      );
    }

    const cssModuleRules: RuleSetRule[] = [
      {
        test: /\.module\.css$/,
        exclude: globalStylePaths,
        use: getCommonLoadersForCssModules(mergedOptions, includePaths),
      },
      {
        test: /\.module\.(scss|sass)$/,
        exclude: globalStylePaths,
        use: [
          ...getCommonLoadersForCssModules(mergedOptions, includePaths),
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
        exclude: globalStylePaths,
        use: [
          ...getCommonLoadersForCssModules(mergedOptions, includePaths),
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
        exclude: globalStylePaths,
        use: [
          ...getCommonLoadersForCssModules(mergedOptions, includePaths),
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
        exclude: globalStylePaths,
        use: getCommonLoadersForGlobalCss(mergedOptions, includePaths),
      },
      {
        test: /\.scss$|\.sass$/,
        exclude: globalStylePaths,
        use: [
          ...getCommonLoadersForGlobalCss(mergedOptions, includePaths),
          {
            loader: require.resolve('sass-loader'),
            options: {
              implementation: require('sass'),
              sourceMap: !!mergedOptions.sourceMap,
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
        exclude: globalStylePaths,
        use: [
          ...getCommonLoadersForGlobalCss(mergedOptions, includePaths),
          {
            loader: require.resolve('less-loader'),
            options: {
              sourceMap: !!mergedOptions.sourceMap,
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
        exclude: globalStylePaths,
        use: [
          ...getCommonLoadersForGlobalCss(mergedOptions, includePaths),
          {
            loader: require.resolve('stylus-loader'),
            options: {
              sourceMap: !!mergedOptions.sourceMap,
              stylusOptions: {
                include: includePaths,
              },
            },
          },
        ],
      },
    ];

    const globalStyleRules: RuleSetRule[] = [
      {
        test: /\.css$/,
        include: globalStylePaths,
        use: getCommonLoadersForGlobalStyle(mergedOptions, includePaths),
      },
      {
        test: /\.scss$|\.sass$/,
        include: globalStylePaths,
        use: [
          ...getCommonLoadersForGlobalStyle(mergedOptions, includePaths),
          {
            loader: require.resolve('sass-loader'),
            options: {
              implementation: require('sass'),
              sourceMap: !!mergedOptions.sourceMap,
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
        include: globalStylePaths,
        use: [
          ...getCommonLoadersForGlobalStyle(mergedOptions, includePaths),
          {
            loader: require.resolve('less-loader'),
            options: {
              sourceMap: !!mergedOptions.sourceMap,
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
        include: globalStylePaths,
        use: [
          ...getCommonLoadersForGlobalStyle(mergedOptions, includePaths),
          {
            loader: require.resolve('stylus-loader'),
            options: {
              sourceMap: !!mergedOptions.sourceMap,
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
        oneOf: [...cssModuleRules, ...globalCssRules, ...globalStyleRules],
      },
    ];

    plugins.push(
      // extract global css from js files into own css file
      new MiniCssExtractPlugin({
        filename: `[name]${hashFormat.extract}.css`,
      })
    );

    config.output = {
      ...config.output,
      crossOriginLoading: mergedOptions.subresourceIntegrity
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
      minimizer: [...config.optimization.minimizer, ...minimizer],
      emitOnErrors: false,
      moduleIds: 'deterministic' as const,
      runtimeChunk: mergedOptions.runtimeChunk ? ('single' as const) : false,
      splitChunks: {
        maxAsyncRequests: Infinity,
        cacheGroups: {
          default: !!mergedOptions.commonChunk && {
            chunks: 'async' as const,
            minChunks: 2,
            priority: 10,
          },
          common: !!mergedOptions.commonChunk && {
            name: 'common',
            chunks: 'async' as const,
            minChunks: 2,
            enforce: true,
            priority: 5,
          },
          vendors: false as const,
          vendor: !!mergedOptions.vendorChunk && {
            name: 'vendor',
            chunks: (chunk) => chunk.name === 'main',
            enforce: true,
            test: /[\\/]node_modules[\\/]/,
          },
        },
      },
    };

    config.plugins.push(...plugins);

    config.resolve.mainFields = ['browser', 'module', 'main'];

    config.module = {
      ...config.module,
      rules: [
        ...(config.module.rules ?? []),
        // Images: Inline small images, and emit a separate file otherwise.
        {
          test: /\.(avif|bmp|gif|ico|jpe?g|png|webp)$/,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 10_000, // 10 kB
            },
          },
          generator: {
            filename: `[name]${hashFormat.file}[ext]`,
          },
        },
        // SVG: same as image but we need to separate it so it can be swapped for SVGR in the React plugin.
        {
          test: /\.svg$/,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 10_000, // 10 kB
            },
          },
          generator: {
            filename: `[name]${hashFormat.file}[ext]`,
          },
        },
        // Fonts: Emit separate file and export the URL.
        {
          test: /\.(eot|otf|ttf|woff|woff2)$/,
          type: 'asset/resource',
          generator: {
            filename: `[name]${hashFormat.file}[ext]`,
          },
        },
        ...rules,
      ],
    };
    processed.add(config);
    return config;
  };
}

function createScriptsPlugin(options: MergedOptions): WebpackPluginInstance[] {
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
  options: MergedOptions,
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

function getCommonLoadersForGlobalCss(
  options: MergedOptions,
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
        postcssOptions: postcssOptionsCreator(options, { includePaths }),
      },
    },
  ];
}

function getCommonLoadersForGlobalStyle(
  options: MergedOptions,
  includePaths: string[]
) {
  return [
    {
      loader: MiniCssExtractPlugin.loader,
      options: { esModule: true },
    },
    { loader: require.resolve('css-loader'), options: { url: false } },
    {
      loader: require.resolve('postcss-loader'),
      options: {
        implementation: require('postcss'),
        postcssOptions: postcssOptionsCreator(options, { includePaths }),
      },
    },
  ];
}

function postcssOptionsCreator(
  options: MergedOptions,
  {
    includePaths,
    forCssModules = false,
  }: { includePaths: string[]; forCssModules?: boolean }
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
