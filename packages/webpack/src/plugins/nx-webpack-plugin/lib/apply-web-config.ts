import * as path from 'path';
import { SubresourceIntegrityPlugin } from 'webpack-subresource-integrity';
import {
  Configuration,
  DefinePlugin,
  ids,
  RuleSetRule,
  WebpackOptionsNormalized,
  WebpackPluginInstance,
} from 'webpack';

import { WriteIndexHtmlPlugin } from '../../write-index-html-plugin';
import { NormalizedNxAppWebpackPluginOptions } from '../nx-app-webpack-plugin-options';
import { getOutputHashFormat } from '../../../utils/hash-format';
import { getClientEnvironment } from '../../../utils/get-client-environment';
import { normalizeExtraEntryPoints } from '../../../utils/webpack/normalize-entry';
import {
  getCommonLoadersForCssModules,
  getCommonLoadersForGlobalCss,
  getCommonLoadersForGlobalStyle,
} from './stylesheet-loaders';
import { instantiateScriptPlugins } from './instantiate-script-plugins';
import CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
import MiniCssExtractPlugin = require('mini-css-extract-plugin');
import { getDevServerOptions } from '../../../executors/dev-server/lib/get-dev-server-config';
import { NormalizedWebpackExecutorOptions } from '../../../executors/webpack/schema';

export function applyWebConfig(
  options: NormalizedNxAppWebpackPluginOptions,
  config: Partial<WebpackOptionsNormalized | Configuration> = {},
  {
    useNormalizedEntry,
  }: {
    // webpack.Configuration allows arrays to be set on a single entry
    // webpack then normalizes them to { import: "..." } objects
    // This option allows use to preserve existing composePlugins behavior where entry.main is an array.
    useNormalizedEntry?: boolean;
  } = {}
): void {
  if (!process.env['NX_TASK_TARGET_PROJECT']) return;

  // Defaults that was applied from executor schema previously.
  options.runtimeChunk ??= true; // need this for HMR and other things to work
  options.extractCss ??= true;
  options.generateIndexHtml ??= true;
  options.styles ??= [];
  options.scripts ??= [];

  const plugins: WebpackPluginInstance[] = [];

  const stylesOptimization =
    typeof options.optimization === 'object'
      ? options.optimization.styles
      : options.optimization;

  if (Array.isArray(options.scripts)) {
    plugins.push(...instantiateScriptPlugins(options));
  }
  if (options.index && options.generateIndexHtml) {
    plugins.push(
      new WriteIndexHtmlPlugin({
        crossOrigin: options.crossOrigin,
        sri: options.subresourceIntegrity,
        outputPath: path.basename(options.index),
        indexPath: path.join(options.root, options.index),
        baseHref: options.baseHref,
        deployUrl: options.deployUrl,
        scripts: options.scripts,
        styles: options.styles,
      })
    );
  }

  if (options.subresourceIntegrity) {
    plugins.push(new SubresourceIntegrityPlugin());
  }

  const minimizer: WebpackPluginInstance[] = [new ids.HashedModuleIdsPlugin()];
  if (stylesOptimization) {
    minimizer.push(
      new CssMinimizerPlugin({
        test: /\.(?:css|scss|sass|less|styl)$/,
      })
    );
  }
  if (!options.ssr) {
    plugins.push(
      new DefinePlugin(getClientEnvironment(process.env.NODE_ENV).stringified)
    );
  }

  const entries: { [key: string]: { import: string[] } } = {};
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
      if (entries[style.bundleName]) {
        entries[style.bundleName].import.push(resolvedPath);
      } else {
        entries[style.bundleName] = { import: [resolvedPath] };
      }

      // Add global css paths.
      globalStylePaths.push(resolvedPath);
    });
  }

  const cssModuleRules: RuleSetRule[] = [
    {
      test: /\.module\.css$/,
      exclude: globalStylePaths,
      use: getCommonLoadersForCssModules(options, includePaths),
    },
    {
      test: /\.module\.(scss|sass)$/,
      exclude: globalStylePaths,
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
      exclude: globalStylePaths,
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
      exclude: globalStylePaths,
      use: [
        ...getCommonLoadersForCssModules(options, includePaths),
        {
          loader: path.join(
            __dirname,
            '../../../utils/webpack/deprecated-stylus-loader.js'
          ),
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
      use: getCommonLoadersForGlobalCss(options, includePaths),
    },
    {
      test: /\.scss$|\.sass$/,
      exclude: globalStylePaths,
      use: [
        ...getCommonLoadersForGlobalCss(options, includePaths),
        {
          loader: require.resolve('sass-loader'),
          options: {
            implementation: require('sass'),
            sourceMap: !!options.sourceMap,
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
        ...getCommonLoadersForGlobalCss(options, includePaths),
        {
          loader: require.resolve('less-loader'),
          options: {
            sourceMap: !!options.sourceMap,
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
        ...getCommonLoadersForGlobalCss(options, includePaths),
        {
          loader: path.join(
            __dirname,
            '../../../utils/webpack/deprecated-stylus-loader.js'
          ),
          options: {
            sourceMap: !!options.sourceMap,
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
      use: getCommonLoadersForGlobalStyle(options, includePaths),
    },
    {
      test: /\.scss$|\.sass$/,
      include: globalStylePaths,
      use: [
        ...getCommonLoadersForGlobalStyle(options, includePaths),
        {
          loader: require.resolve('sass-loader'),
          options: {
            implementation: require('sass'),
            sourceMap: !!options.sourceMap,
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
        ...getCommonLoadersForGlobalStyle(options, includePaths),
        {
          loader: require.resolve('less-loader'),
          options: {
            sourceMap: !!options.sourceMap,
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
        ...getCommonLoadersForGlobalStyle(options, includePaths),
        {
          loader: path.join(
            __dirname,
            '../../../utils/webpack/deprecated-stylus-loader.js'
          ),
          options: {
            sourceMap: !!options.sourceMap,
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

  if (options.extractCss) {
    plugins.push(
      // extract global css from js files into own css file
      new MiniCssExtractPlugin({
        filename: `[name]${hashFormat.extract}.css`,
      })
    );
  }

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

  Object.entries(entries).forEach(([entryName, entryData]) => {
    if (useNormalizedEntry) {
      config.entry[entryName] = { import: entryData.import };
    } else {
      config.entry[entryName] = entryData.import;
    }
  });

  config.optimization = {
    ...config.optimization,
    minimizer: [...config.optimization.minimizer, ...minimizer],
    emitOnErrors: false,
    moduleIds: 'deterministic' as const,
    runtimeChunk: options.runtimeChunk ? { name: 'runtime' } : false,
    splitChunks: {
      defaultSizeTypes:
        config.optimization.splitChunks !== false
          ? config.optimization.splitChunks?.defaultSizeTypes
          : ['...'],
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

  config.plugins ??= [];
  config.plugins.push(...plugins);
}
