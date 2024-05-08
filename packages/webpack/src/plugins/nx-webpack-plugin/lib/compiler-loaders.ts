import * as path from 'path';
import { readTsConfig } from '@nx/js';

import { NormalizedNxAppWebpackPluginOptions } from '../nx-app-webpack-plugin-options';

export function createLoaderFromCompiler(
  options: NormalizedNxAppWebpackPluginOptions
) {
  switch (options.compiler) {
    case 'swc':
      return {
        test: /\.([jt])sx?$/,
        loader: require.resolve('swc-loader'),
        exclude: /node_modules/,
        options: {
          jsc: {
            parser: {
              syntax: 'typescript',
              decorators: true,
              tsx: true,
            },
            transform: {
              react: {
                runtime: 'automatic',
              },
            },
            loose: true,
          },
        },
      };
    case 'tsc':
      const { loadTsTransformers } = require('@nx/js');
      const { compilerPluginHooks, hasPlugin } = loadTsTransformers(
        options.transformers
      );
      return {
        test: /\.([jt])sx?$/,
        loader: require.resolve(`ts-loader`),
        exclude: /node_modules/,
        options: {
          configFile: options.tsConfig,
          transpileOnly: !hasPlugin,
          // https://github.com/TypeStrong/ts-loader/pull/685
          experimentalWatchApi: true,
          getCustomTransformers: (program) => ({
            before: compilerPluginHooks.beforeHooks.map((hook) =>
              hook(program)
            ),
            after: compilerPluginHooks.afterHooks.map((hook) => hook(program)),
            afterDeclarations: compilerPluginHooks.afterDeclarationsHooks.map(
              (hook) => hook(program)
            ),
          }),
        },
      };
    case 'babel':
      const tsConfig = options.tsConfig
        ? readTsConfig(path.join(options.root, options.tsConfig))
        : undefined;

      const babelConfig = {
        test: /\.([jt])sx?$/,
        loader: path.join(__dirname, '../../../utils/web-babel-loader'),
        exclude: /node_modules/,
        options: {
          cwd: path.join(options.root, options.sourceRoot),
          emitDecoratorMetadata: tsConfig
            ? tsConfig.options.emitDecoratorMetadata
            : false,
          isModern: true,
          isTest: process.env.NX_CYPRESS_COMPONENT_TEST === 'true',
          envName: process.env.BABEL_ENV ?? process.env.NODE_ENV,
          cacheDirectory: true,
          cacheCompression: false,
        },
      };

      if (options.babelUpwardRootMode) {
        babelConfig.options['rootMode'] = 'upward';
        babelConfig.options['babelrc'] = true;
      } else {
        babelConfig.options['configFile'] = options.babelConfig
          ? path.join(options.root, options.babelConfig)
          : path.join(options.root, options.projectRoot, '.babelrc');
      }

      return babelConfig;
    default:
      return null;
  }
}
