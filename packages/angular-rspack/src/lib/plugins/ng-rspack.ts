import {
  Compiler,
  CopyRspackPlugin,
  DefinePlugin,
  RspackPluginInstance,
} from '@rspack/core';
import { posix, relative, resolve } from 'node:path';
import { getEntryPoints } from '../config/config-utils/entry-points';
import type {
  I18nOptions,
  NormalizedAngularRspackPluginOptions,
} from '../models';
import { AngularRspackPlugin } from './angular-rspack-plugin';
import { AngularSsrDevServer } from './angular-ssr-dev-server';
import { I18nInlinePlugin } from './i18n-inline-plugin';
import { IndexHtmlPlugin } from './index-html-plugin';
import { RxjsEsmResolutionPlugin } from './rxjs-esm-resolution';
import { ProgressPlugin } from './progress-plugin';
import { loadEsmModule } from '../utils/misc-helpers';

export class NgRspackPlugin implements RspackPluginInstance {
  readonly pluginOptions: NormalizedAngularRspackPluginOptions;
  readonly isPlatformServer: boolean;
  readonly i18n: I18nOptions;

  constructor(
    pluginOptions: NormalizedAngularRspackPluginOptions,
    extraOptions: {
      platform: 'browser' | 'server';
      i18nOptions: I18nOptions;
    }
  ) {
    this.pluginOptions = pluginOptions;
    this.i18n = extraOptions.i18nOptions;
    this.isPlatformServer = extraOptions.platform === 'server';
  }

  apply(compiler: Compiler) {
    const root = this.pluginOptions.root;
    const isDevServer = process.env['WEBPACK_SERVE'];

    if (this.isPlatformServer && isDevServer) {
      if (
        this.pluginOptions.ssr &&
        typeof this.pluginOptions.ssr === 'object' &&
        this.pluginOptions.ssr.entry !== undefined
      ) {
        new AngularSsrDevServer(this.pluginOptions).apply(compiler);
      }
    }
    if (!isDevServer && this.pluginOptions.progress) {
      new ProgressPlugin(this.isPlatformServer ? 'server' : 'browser').apply(
        compiler
      );
    }
    new DefinePlugin({
      ...(this.pluginOptions.optimization.scripts
        ? { ngDevMode: 'false' }
        : {}),
      ngJitMode: this.pluginOptions.aot ? undefined : 'true',
      ngServerMode: this.isPlatformServer,
      ngHmrMode:
        this.pluginOptions.devServer?.hmr && isDevServer ? 'true' : 'false',
      ...(this.pluginOptions.define ?? {}),
    }).apply(compiler);
    if (this.pluginOptions.assets && !this.isPlatformServer) {
      new CopyRspackPlugin({
        patterns: (this.pluginOptions.assets ?? []).map((asset) => {
          let { input, output = '' } = asset;
          input = resolve(root, input).replace(/\\/g, '/');
          input = input.endsWith('/') ? input : input + '/';
          output = output.endsWith('/') ? output : output + '/';

          if (output.startsWith('..')) {
            throw new Error(
              'An asset cannot be written to a location outside of the output path.'
            );
          }

          return {
            context: input,
            to: output.replace(/^\//, ''),
            from: asset.glob,
            noErrorOnMissing: true,
            force: true,
            globOptions: {
              dot: true,
              ignore: [
                '.gitkeep',
                '**/.DS_Store',
                '**/Thumbs.db',
                ...(asset.ignore ?? []),
              ],
            },
          };
        }),
      }).apply(compiler);
    }
    if (this.pluginOptions.extractLicenses) {
      const { LicenseWebpackPlugin } = require('license-webpack-plugin');
      new LicenseWebpackPlugin({
        stats: {
          warnings: false,
          errors: false,
        },
        perChunkOutput: false,
        outputFilename: posix.join(
          relative(
            this.pluginOptions.outputPath.browser,
            this.pluginOptions.outputPath.base
          ),
          '3rdpartylicenses.txt'
        ),
        skipChildCompilers: true,
      }).apply(compiler as any);
    }
    if (this.i18n.shouldInline) {
      new I18nInlinePlugin(this.pluginOptions, this.i18n).apply(compiler);
    }
    new RxjsEsmResolutionPlugin().apply(compiler);
    new AngularRspackPlugin(this.pluginOptions, this.i18n).apply(compiler);
    if (!this.isPlatformServer && this.pluginOptions.index) {
      new IndexHtmlPlugin({
        indexPath: this.pluginOptions.index.input,
        index: this.pluginOptions.index,
        baseHref: this.pluginOptions.baseHref,
        outputPath: this.pluginOptions.outputPath.browser,
        entrypoints: getEntryPoints(
          this.pluginOptions.globalStyles,
          this.pluginOptions.globalScripts,
          this.pluginOptions.devServer?.hmr
        ),
        i18n: this.i18n,
        optimization: this.pluginOptions.optimization,
        postTransform: this.pluginOptions.index.transformer,
        isSsr: !!(
          this.pluginOptions.ssr ||
          this.pluginOptions.prerender ||
          this.pluginOptions.appShell
        ),
        deployUrl: this.pluginOptions.deployUrl,
        crossOrigin: this.pluginOptions.crossOrigin,
        sri: this.pluginOptions.subresourceIntegrity,
      }).apply(compiler);
    }
    if (
      this.pluginOptions.devServer.open &&
      isDevServer &&
      !this.isPlatformServer
    ) {
      compiler.hooks.afterEmit.tapAsync(
        'AngularRspackPlugin',
        async (_, callback) => {
          const protocol = this.pluginOptions.devServer.ssl ? 'https' : 'http';
          const hostname =
            this.pluginOptions.devServer.host === '0.0.0.0'
              ? 'localhost'
              : this.pluginOptions.devServer.host;
          const port = this.pluginOptions.devServer.port;
          const pathname =
            typeof compiler.options.devServer?.devMiddleware?.publicPath ===
            'string'
              ? compiler.options.devServer?.devMiddleware?.publicPath
              : undefined;

          const serverAddress = new URL(`${protocol}://${hostname}:${port}`);
          if (pathname) {
            // Ensure pathname starts with a slash
            serverAddress.pathname = pathname.startsWith('/')
              ? pathname
              : `/${pathname}`;
          }

          const open = (await loadEsmModule<typeof import('open')>('open'))
            .default;
          await open(serverAddress.toString());
          callback();
        }
      );
    }
  }
}
