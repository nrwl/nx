import { VERSION } from '@angular/core';
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
import { loadEsmModule } from '../utils/misc-helpers';
import { isServeMode } from '../utils/rspack-serve-env';
import { AngularRspackPlugin } from './angular-rspack-plugin';
import { AngularSsrDevServer } from './angular-ssr-dev-server';
import {
  ExtractLicensesPlugin,
  type SharedLicenseInputs,
} from './extract-licenses-plugin';
import { I18nInlinePlugin } from './i18n-inline-plugin';
import { IndexHtmlPlugin } from './index-html-plugin';
import { ProgressPlugin } from './progress-plugin';
import { RxjsEsmResolutionPlugin } from './rxjs-esm-resolution';

export class NgRspackPlugin implements RspackPluginInstance {
  readonly pluginOptions: NormalizedAngularRspackPluginOptions;
  readonly isPlatformServer: boolean;
  readonly i18n: I18nOptions;
  private readonly sharedLicenseInputs: SharedLicenseInputs | undefined;
  private readonly sharedAngularPlugin: AngularRspackPlugin | undefined;

  constructor(
    pluginOptions: NormalizedAngularRspackPluginOptions,
    extraOptions: {
      platform: 'browser' | 'server';
      i18nOptions: I18nOptions;
      /**
       * License extraction inputs shared across the compilers of an SSR
       * build, so the browser and server compilers emit the union instead of
       * overwriting each other's licenses file.
       */
      sharedLicenseInputs?: SharedLicenseInputs;
      /**
       * Angular compilation shared across the compilers of an SSR build: the
       * browser compiler owns it (its program includes the server entry
       * points) and the server compiler consumes its output instead of
       * running a second compilation. When absent, each compiler runs its
       * own compilation.
       */
      sharedAngularPlugin?: AngularRspackPlugin;
    }
  ) {
    this.pluginOptions = pluginOptions;
    this.i18n = extraOptions.i18nOptions;
    this.isPlatformServer = extraOptions.platform === 'server';
    this.sharedLicenseInputs = extraOptions.sharedLicenseInputs;
    this.sharedAngularPlugin = extraOptions.sharedAngularPlugin;
  }

  apply(compiler: Compiler) {
    const root = this.pluginOptions.root;
    const isDevServer = isServeMode();

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
      ngJitMode: this.pluginOptions.aot
        ? +VERSION.major >= 21
          ? 'false'
          : undefined
        : 'true',
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
                '**/.gitkeep',
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
      new ExtractLicensesPlugin({
        outputFilename: posix.join(
          relative(
            this.pluginOptions.outputPath.browser,
            this.pluginOptions.outputPath.base
          ),
          '3rdpartylicenses.txt'
        ),
        rootDirectory: root,
        sharedInputs: this.sharedLicenseInputs,
      }).apply(compiler);
    }
    if (this.i18n.shouldInline) {
      new I18nInlinePlugin(this.pluginOptions, this.i18n).apply(compiler);
    }
    new RxjsEsmResolutionPlugin().apply(compiler);
    if (this.sharedAngularPlugin) {
      if (this.isPlatformServer) {
        this.sharedAngularPlugin.applyToDependentCompiler(compiler);
      } else {
        this.sharedAngularPlugin.apply(compiler);
      }
    } else {
      new AngularRspackPlugin(this.pluginOptions, this.i18n).apply(compiler);
    }
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
        // The augment plugin captures this map at construction; IndexHtmlPlugin
        // fills it during the build so SRI builds emit a lazy-chunk integrity
        // importmap (on the Angular versions that support it).
        chunksIntegrity: this.pluginOptions.subresourceIntegrity
          ? new Map()
          : undefined,
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
          const devServerOpts = compiler.options.devServer;
          const publicPath =
            typeof devServerOpts === 'object'
              ? devServerOpts.devMiddleware?.publicPath
              : undefined;
          const pathname =
            typeof publicPath === 'string' ? publicPath : undefined;

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
