import { Configuration } from '@rspack/core';
import * as path from 'path';
import { getCopyPatterns } from './get-copy-patterns';
import { SharedConfigContext } from './model';
import { normalizeAssets } from './normalize-assets';

export function withNx(_opts = {}) {
  return function makeConfig(
    config: Configuration,
    { options, context }: SharedConfigContext
  ): Configuration {
    const isProd = process.env.NODE_ENV === 'production';
    const isDev = process.env.NODE_ENV === 'development';
    const projectRoot = path.join(
      context.root,
      context.projectGraph.nodes[context.projectName].data.root
    );
    const sourceRoot = path.join(
      context.root,
      context.projectGraph.nodes[context.projectName].data.sourceRoot
    );

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tsconfigPaths = require('tsconfig-paths');
    const { paths } = tsconfigPaths.loadConfig(options.tsConfig);
    const alias = Object.keys(paths).reduce((acc, k) => {
      acc[k] = path.join(context.root, paths[k][0]);
      return acc;
    }, {});

    const updated = {
      ...config,
      target: options.target,
      mode: 'development' as const,
      context: context.root,
      devtool:
        options.sourceMap === 'hidden'
          ? ('hidden-source-map' as const)
          : options.sourceMap
          ? ('source-map' as const)
          : (false as const),
      entry: {
        main: {
          import: [path.join(context.root, options.main)],
        },
      },
      output: {
        path: path.join(context.root, options.outputPath),
        publicPath: '/',
        filename: isProd ? '[name].[contenthash:8][ext]' : '[name][ext]',
      },
      devServer: {
        port: 4200,
        hot: true,
      } as any,
      module: {
        rules: [
          {
            test: /\.css$/,
            type: 'css/module' as any,
          },
        ],
      },
      plugins: config.plugins ?? [],
      resolve: {
        alias,
        // This is not working it seems.
        //plugins: [new TsconfigPathsPlugin({
        //  configFile: path.resolve(__dirname, 'tsconfig.app.json')
        //})]
      },
      infrastructureLogging: {
        debug: false,
      },
      builtins: {
        copy: {
          patterns: getCopyPatterns(
            normalizeAssets(options.assets, context.root, sourceRoot)
          ),
        },
        html: [
          {
            template: options.indexHtml
              ? path.join(context.root, options.indexHtml)
              : path.join(projectRoot, 'src/index.html'),
          },
        ],
        define: {
          'process.env.NODE_ENV': isProd ? "'production'" : "'development'",
        },
        progress: {},
        // TODO(jack): This should go to withReact.
        react: {
          runtime: 'automatic',
          development: isDev,
          refresh: isDev,
        },
      },
    };

    if (options.optimization) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const minifyPlugin = require('@rspack/plugin-minify');
      updated.optimization = {
        ...config.optimization,
        minimize: true,
        minimizer: [
          ...(config.optimization?.minimizer || []),
          new minifyPlugin({
            minifier: 'terser',
          }),
        ],
      };
    }

    return updated;
  };
}
