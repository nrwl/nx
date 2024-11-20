import {
  type RspackPluginInstance,
  type Configuration,
  type RuleSetRule,
  LightningCssMinimizerRspackPlugin,
  DefinePlugin,
  HtmlRspackPlugin,
  CssExtractRspackPlugin,
  EnvironmentPlugin,
  RspackOptionsNormalized,
} from '@rspack/core';
import { instantiateScriptPlugins } from './instantiate-script-plugins';
import { join, resolve } from 'path';
import { getOutputHashFormat } from './hash-format';
import { normalizeExtraEntryPoints } from './normalize-entry';
import {
  getCommonLoadersForCssModules,
  getCommonLoadersForGlobalCss,
  getCommonLoadersForGlobalStyle,
} from './loaders/stylesheet-loaders';
import { NormalizedNxAppRspackPluginOptions } from './models';

export function applyWebConfig(
  options: NormalizedNxAppRspackPluginOptions,
  config: Partial<RspackOptionsNormalized | Configuration> = {},
  {
    useNormalizedEntry,
  }: {
    // rspack.Configuration allows arrays to be set on a single entry
    // rspack then normalizes them to { import: "..." } objects
    // This option allows use to preserve existing composePlugins behavior where entry.main is an array.
    useNormalizedEntry?: boolean;
  } = {}
): void {
  if (global.NX_GRAPH_CREATION) return;

  // Defaults that was applied from executor schema previously.
  options.runtimeChunk ??= true; // need this for HMR and other things to work
  options.extractCss ??= true;
  options.generateIndexHtml ??= true;
  options.index = options.index
    ? join(options.root, options.index)
    : join(
        options.root,
        options.projectGraph.nodes[options.projectName].data.sourceRoot,
        'index.html'
      );
  options.styles ??= [];
  options.scripts ??= [];

  const isProd =
    process.env.NODE_ENV === 'production' || options.mode === 'production';

  const plugins: RspackPluginInstance[] = [
    new EnvironmentPlugin({
      NODE_ENV: isProd ? 'production' : 'development',
    }),
  ];

  const stylesOptimization =
    typeof options.optimization === 'object'
      ? options.optimization.styles
      : options.optimization;

  if (Array.isArray(options.scripts)) {
    plugins.push(...instantiateScriptPlugins(options));
  }
  if (options.index && options.generateIndexHtml) {
    plugins.push(
      new HtmlRspackPlugin({
        template: options.index,
        sri: 'sha256',
        ...(options.baseHref ? { base: { href: options.baseHref } } : {}),
        ...(config.output?.scriptType === 'module'
          ? { scriptLoading: 'module' }
          : {}),
      })
    );
  }

  const minimizer: RspackPluginInstance[] = [];
  if (isProd && stylesOptimization) {
    minimizer.push(
      new LightningCssMinimizerRspackPlugin({
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
        includePaths.push(resolve(options.root, includePath))
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
      const resolvedPath = style.input.startsWith('.')
        ? style.input
        : resolve(options.root, style.input);

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
          loader: join(
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
          loader: join(
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
          loader: join(
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
      new CssExtractRspackPlugin({
        filename: `[name]${hashFormat.extract}.css`,
      })
    );
  }

  config.output = {
    ...(config.output ?? {}),
    assetModuleFilename: '[name].[contenthash:16][ext]',
    crossOriginLoading: 'anonymous',
  };

  // In case users customize their rspack config with unsupported entry.
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

  config.optimization = !isProd
    ? {}
    : {
        ...(config.optimization ?? {}),
        minimizer: [...(config.optimization?.minimizer ?? []), ...minimizer],
        emitOnErrors: false,
        moduleIds: 'deterministic' as const,
        runtimeChunk: options.runtimeChunk ? { name: 'runtime' } : false,
        splitChunks: {
          defaultSizeTypes:
            config.optimization?.splitChunks !== false
              ? config.optimization?.splitChunks?.defaultSizeTypes
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
    ...(config.module ?? {}),
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
      },
      // Fonts: Emit separate file and export the URL.
      {
        test: /\.(eot|otf|ttf|woff|woff2)$/,
        type: 'asset/resource',
      },
      ...rules,
    ],
  };

  config.plugins ??= [];
  config.plugins.push(...plugins);
}

function getClientEnvironment(mode?: string) {
  // Grab NODE_ENV and NX_PUBLIC_* environment variables and prepare them to be
  // injected into the application via DefinePlugin in rspack configuration.
  const nxPublicKeyRegex = /^NX_PUBLIC_/i;

  const raw = Object.keys(process.env)
    .filter((key) => nxPublicKeyRegex.test(key))
    .reduce((env, key) => {
      env[key] = process.env[key];
      return env;
    }, {});

  // Stringify all values so we can feed into rspack DefinePlugin
  const stringified = {
    'process.env': Object.keys(raw).reduce((env, key) => {
      env[key] = JSON.stringify(raw[key]);
      return env;
    }, {}),
  };

  return { stringified };
}
