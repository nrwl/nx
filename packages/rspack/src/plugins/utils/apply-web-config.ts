import { getProjectSourceRoot } from '@nx/js/src/utils/typescript/ts-solution-setup';
import {
  type Configuration,
  type RspackPluginInstance,
  type RuleSetRule,
  CssExtractRspackPlugin,
  DefinePlugin,
  EnvironmentPlugin,
  HtmlRspackPlugin,
  LightningCssMinimizerRspackPlugin,
  RspackOptionsNormalized,
} from '@rspack/core';
import { join, resolve } from 'path';
import { WriteIndexHtmlPlugin } from '../write-index-html-plugin';
import { getOutputHashFormat } from './hash-format';
import { instantiateScriptPlugins } from './instantiate-script-plugins';
import {
  getCommonLoadersForCssModules,
  getCommonLoadersForGlobalCss,
  getCommonLoadersForGlobalStyle,
} from './loaders/stylesheet-loaders';
import { NormalizedNxAppRspackPluginOptions } from './models';
import { normalizeExtraEntryPoints } from './normalize-entry';

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
        getProjectSourceRoot(
          options.projectGraph.nodes[options.projectName].data
        ),
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
    if (options.useLegacyHtmlPlugin) {
      plugins.push(
        new WriteIndexHtmlPlugin({
          indexPath: options.index,
          outputPath: 'index.html',
          baseHref:
            typeof options.baseHref === 'string' ? options.baseHref : undefined,
          sri: options.subresourceIntegrity,
          scripts: options.scripts,
          styles: options.styles,
          crossOrigin:
            config.output?.scriptType === 'module' ? 'anonymous' : undefined,
        })
      );
    } else {
      plugins.push(
        new HtmlRspackPlugin({
          template: options.index,
          templateParameters: options.templateParameters,
          sri: options.subresourceIntegrity ? 'sha256' : undefined,
          ...(options.baseHref ? { base: { href: options.baseHref } } : {}),
          ...(config.output?.scriptType === 'module'
            ? { scriptLoading: 'module' }
            : {}),
        })
      );
    }
  }

  const minimizer: RspackPluginInstance[] = [];
  if (isProd && stylesOptimization) {
    minimizer.push(
      new LightningCssMinimizerRspackPlugin({
        test: /\.(?:css|scss|sass|less)$/,
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

  const sassOptions = options.stylePreprocessorOptions?.sassOptions;
  const lessOptions = options.stylePreprocessorOptions?.lessOptions;
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
            implementation:
              options.sassImplementation === 'sass'
                ? require.resolve('sass')
                : require.resolve('sass-embedded'),
            api: 'modern-compiler',
            sassOptions: {
              fiber: false,
              precision: 8,
              loadPaths: includePaths,
              ...(sassOptions ?? {}),
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
              ...(lessOptions ?? {}),
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
            api: 'modern-compiler',
            implementation:
              options.sassImplementation === 'sass'
                ? require.resolve('sass')
                : require.resolve('sass-embedded'),
            sourceMap: !!options.sourceMap,
            sassOptions: {
              fiber: false,
              // bootstrap-sass requires a minimum precision of 8
              precision: 8,
              loadPaths: includePaths,
              ...(sassOptions ?? {}),
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
              ...(lessOptions ?? {}),
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
            api: 'modern-compiler',
            implementation:
              options.sassImplementation === 'sass'
                ? require.resolve('sass')
                : require.resolve('sass-embedded'),
            sourceMap: !!options.sourceMap,
            sassOptions: {
              fiber: false,
              // bootstrap-sass requires a minimum precision of 8
              precision: 8,
              loadPaths: includePaths,
              ...(sassOptions ?? {}),
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
              ...(lessOptions ?? {}),
            },
          },
        },
      ],
    },
  ];

  const rules: RuleSetRule[] = [
    {
      test: /\.css$|\.scss$|\.sass$|\.less$/,
      oneOf: [...cssModuleRules, ...globalCssRules, ...globalStyleRules],
    },
  ];

  if (options.extractCss) {
    plugins.push(
      // extract global css from js files into own css file
      new CssExtractRspackPlugin({
        filename:
          config.output?.cssFilename ??
          (options.outputHashing
            ? `[name]${hashFormat.extract}.css`
            : '[name].css'),
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
