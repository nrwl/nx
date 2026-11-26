import * as path from 'path';
import type { Program } from 'typescript';
import { readTsConfig } from '@nx/js';

import { ApplyConfigOptions } from '../nx-app-webpack-plugin-options';

export function createLoaderFromCompiler(options: ApplyConfigOptions) {
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
              legacyDecorator: true,
              decoratorMetadata: true,
              react: {
                runtime: 'automatic',
              },
            },
            loose: true,
          },
        },
      };
    case 'tsc':
      const { loadTsTransformers } =
        require('@nx/js') as typeof import('@nx/js');
      const { compilerPluginHooks, hasPlugin } = loadTsTransformers(
        options.transformers ?? []
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
          // ts-loader 9.5.7+ forwards the tsconfig rootDir to transpileModule, so
          // workspace lib sources bundled from source (outside the app rootDir)
          // fail with TS6059. rootDir only governs emit layout, which webpack owns
          // here (the default transpile path emits JS, not declarations), so widen
          // it to the workspace root to clear the error without altering output.
          compilerOptions: { rootDir: options.root },
          getCustomTransformers: (program: Program) => ({
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
          ...(options.babelUpwardRootMode
            ? { rootMode: 'upward', babelrc: true }
            : {
                configFile: options.babelConfig
                  ? path.join(options.root, options.babelConfig)
                  : path.join(options.root, options.projectRoot, '.babelrc'),
              }),
        },
      };

      return babelConfig;
    default:
      return null;
  }
}
