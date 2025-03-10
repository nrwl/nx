import { NgRspackPlugin } from '../plugins/ng-rspack';
import {
  Configuration,
  DevServer,
  SwcJsMinimizerRspackPlugin,
} from '@rspack/core';
import { merge as rspackMerge } from 'webpack-merge';
import { join } from 'path';
import { AngularRspackPluginOptions, normalizeOptions } from '../models';
import {
  JS_ALL_EXT_REGEX,
  TS_ALL_EXT_REGEX,
} from '@nx/angular-rspack-compiler';
import { getStyleLoaders } from './style-config-utils';

export function _createConfig(
  options: AngularRspackPluginOptions,
  rspackConfigOverrides?: Partial<Configuration>
): Configuration[] {
  const normalizedOptions = normalizeOptions(options);
  const isProduction = process.env['NODE_ENV'] === 'production';

  const defaultConfig = {
    context: normalizedOptions.root,
    mode: isProduction ? 'production' : 'development',
    output: {
      uniqueName: 'rspack-angular',
      publicPath: 'auto',
      clean: true,
      crossOriginLoading: false,
      trustedTypes: { policyName: 'angular#bundler' },
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.mjs', '.js'],
      modules: ['node_modules'],
      mainFields: ['es2020', 'es2015', 'browser', 'module', 'main'],
      conditionNames: ['es2020', 'es2015', '...'],
      tsConfig: {
        configFile: normalizedOptions.tsConfig,
      },
    },
    experiments: {
      css: true,
    },
    module: {
      parser: {
        javascript: {
          requireContext: false,
          url: false,
        },
        'css/auto': {
          esModule: true,
        },
      },
      rules: [
        ...getStyleLoaders(options.stylePreprocessorOptions),
        { test: /[/\\]rxjs[/\\]add[/\\].+\.js$/, sideEffects: true },
        {
          test: TS_ALL_EXT_REGEX,
          use: [
            {
              loader: 'builtin:swc-loader',
              options: {
                jsc: {
                  parser: {
                    syntax: 'typescript',
                  },
                  target: 'es2022',
                },
              },
            },
            {
              loader: require.resolve(
                '@nx/angular-rspack/loaders/angular-loader'
              ),
            },
          ],
        },
        {
          test: JS_ALL_EXT_REGEX,
          use: [
            {
              loader: require.resolve(
                '@nx/angular-rspack/loaders/angular-partial-transform-loader'
              ),
            },
          ],
        },
      ],
    },
    plugins: [],
  };

  const configs: Configuration[] = [];
  if (normalizedOptions.hasServer) {
    const serverConfig = {
      ...defaultConfig,
      target: 'node',
      entry: {
        server: {
          import: [normalizedOptions.ssrEntry],
        },
      },
      output: {
        ...defaultConfig.output,
        publicPath: 'auto',
        clean: true,
        path: join(normalizedOptions.root, 'dist', 'server'),
        filename: '[name].js',
        chunkFilename: '[name].js',
      },
      devServer: {
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        allowedHosts: 'auto',
        client: {
          webSocketURL: {
            hostname: 'localhost',
            port: normalizedOptions.devServer?.port ?? 4200,
          },
          overlay: {
            errors: true,
            warnings: false,
            runtimeErrors: true,
          },
          reconnect: true,
        },
        port: normalizedOptions.devServer?.port ?? 4200,
        hot: false,
        liveReload: true,
        watchFiles: ['./src/**/*.*', './public/**/*.*'],
        historyApiFallback: {
          index: '/index.html',
          rewrites: [{ from: /^\/$/, to: 'index.html' }],
        },
        devMiddleware: {
          writeToDisk: (file) => !file.includes('.hot-update.'),
        },
      },
      optimization: normalizedOptions.optimization
        ? {
            minimize: true,
            runtimeChunk: false,
            splitChunks: {
              chunks: 'async',
              minChunks: 1,
              minSize: 20000,
              maxAsyncRequests: 30,
              maxInitialRequests: 30,
              cacheGroups: {
                defaultVendors: {
                  test: /[\\/]node_modules[\\/]/,
                  priority: -10,
                  reuseExistingChunk: true,
                },
                default: {
                  minChunks: 2,
                  priority: -20,
                  reuseExistingChunk: true,
                },
              },
            },
            minimizer: [
              new SwcJsMinimizerRspackPlugin({
                minimizerOptions: {
                  minify: true,
                  mangle: true,
                  compress: {
                    passes: 2,
                  },
                  format: {
                    comments: false,
                  },
                },
              }),
            ],
          }
        : {
            minimize: false,
            minimizer: [],
          },
      plugins: [
        ...defaultConfig.plugins,
        new NgRspackPlugin({
          ...normalizedOptions,
          polyfills: ['zone.js/node'],
        }),
      ],
    };
    const mergedConfig = rspackMerge(
      serverConfig,
      (rspackConfigOverrides as unknown) ?? {}
    );
    configs.push(mergedConfig);
  }

  const browserConfig = {
    ...defaultConfig,
    target: 'web',
    entry: {
      main: {
        import: [normalizedOptions.browser],
      },
    },
    devServer: {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      allowedHosts: 'auto',
      client: {
        webSocketURL: {
          hostname: 'localhost',
          port: options.devServer?.port ?? 4200,
        },
        overlay: {
          errors: true,
          warnings: false,
          runtimeErrors: true,
        },
        reconnect: true,
      },
      hot: false,
      liveReload: true,
      watchFiles: ['./src/**/*.*', './public/**/*.*'],
      historyApiFallback: {
        index: '/index.html',
        rewrites: [{ from: /^\/$/, to: 'index.html' }],
      },
      devMiddleware: {
        writeToDisk: (file) => !file.includes('.hot-update.'),
      },
      port: options.devServer?.port ?? 4200,
      onListening: (devServer) => {
        if (!devServer) {
          throw new Error('@rspack/dev-server is not defined');
        }

        const port =
          (devServer.server?.address() as { port: number })?.port ?? 4200;
        console.log('Listening on port:', port);
      },
    } as DevServer,

    output: {
      ...defaultConfig.output,
      hashFunction: isProduction ? 'xxhash64' : undefined,
      publicPath: 'auto',
      clean: true,
      path: join(normalizedOptions.root, 'dist/browser'),
      cssFilename: isProduction ? '[name].[contenthash].css' : '[name].css',
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
      chunkFilename: isProduction ? '[name].[contenthash].js' : '[name].js',
      scriptType: 'module',
      module: true,
    },
    optimization: normalizedOptions.optimization
      ? {
          minimize: true,
          runtimeChunk: 'single',
          splitChunks: {
            chunks: 'all',
            minChunks: 1,
            minSize: 20000,
            maxAsyncRequests: 30,
            maxInitialRequests: 30,
            cacheGroups: {
              defaultVendors: {
                test: /[\\/]node_modules[\\/]/,
                priority: -10,
                reuseExistingChunk: true,
              },
              default: {
                minChunks: 2,
                priority: -20,
                reuseExistingChunk: true,
              },
            },
          },
          minimizer: [
            new SwcJsMinimizerRspackPlugin({
              minimizerOptions: {
                minify: true,
                mangle: true,
                compress: {
                  passes: 2,
                },
                format: {
                  comments: false,
                },
              },
            }),
          ],
        }
      : {
          minimize: false,
          minimizer: [],
        },
    plugins: [
      ...defaultConfig.plugins,
      new NgRspackPlugin({
        ...normalizedOptions,
        polyfills: ['zone.js'],
        hasServer: false,
      }),
    ],
  };
  const mergedConfig = rspackMerge(
    browserConfig,
    (rspackConfigOverrides as unknown) ?? {}
  );
  configs.unshift(mergedConfig);
  return configs;
}

export function createConfig(
  defaultOptions: {
    options: AngularRspackPluginOptions;
    rspackConfigOverrides?: Partial<Configuration>;
  },
  configurations: Record<
    string,
    {
      options: Partial<AngularRspackPluginOptions>;
      rspackConfigOverrides?: Partial<Configuration>;
    }
  > = {},
  configEnvVar = 'NGRS_CONFIG'
) {
  const configurationMode = process.env[configEnvVar] ?? 'production';
  const isDefault = configurationMode === 'default';
  const isModeConfigured = configurationMode in configurations;

  const mergedBuildOptionsOptions = {
    ...defaultOptions.options,
    ...((!isDefault && isModeConfigured
      ? configurations[configurationMode]?.options
      : {}) ?? {}),
  };

  let mergedRspackConfigOverrides = defaultOptions.rspackConfigOverrides ?? {};
  if (
    !isDefault &&
    isModeConfigured &&
    configurations[configurationMode]?.rspackConfigOverrides
  ) {
    mergedRspackConfigOverrides = rspackMerge(
      mergedRspackConfigOverrides,
      configurations[configurationMode]?.rspackConfigOverrides ?? {}
    );
  }

  return _createConfig(mergedBuildOptionsOptions, mergedRspackConfigOverrides);
}
