import {
  Compiler,
  CopyRspackPlugin,
  DefinePlugin,
  EntryPlugin,
  HtmlRspackPlugin,
  ProgressPlugin,
  RspackPluginInstance,
} from '@rspack/core';
import { posix, relative, resolve } from 'node:path';
import { RxjsEsmResolutionPlugin } from './rxjs-esm-resolution';
import { AngularRspackPlugin } from './angular-rspack-plugin';
import { NormalizedAngularRspackPluginOptions, OutputPath } from '../models';
import { AngularSsrDevServer } from './angular-ssr-dev-server';

export class NgRspackPlugin implements RspackPluginInstance {
  pluginOptions: NormalizedAngularRspackPluginOptions;

  constructor(options: NormalizedAngularRspackPluginOptions) {
    this.pluginOptions = options;
  }

  apply(compiler: Compiler) {
    const root = compiler.options.context ?? process.cwd();
    const isProduction = process.env['NODE_ENV'] === 'production';
    const isDevServer = process.env['WEBPACK_SERVE'];

    const polyfills = this.pluginOptions.polyfills ?? [];
    if (polyfills.length > 0) {
      compiler.hooks.entryOption.tap('NgRspackPlugin', (context, entry) => {
        const keys = Object.keys(entry);
        for (const key of keys) {
          const entryValue = entry[key];
          entryValue.import = [...polyfills, ...entryValue.import];
        }
      });
    }
    if (!this.pluginOptions.hasServer) {
      // @TODO: properly handle global styles and scripts
      const styles = this.pluginOptions.globalStyles ?? [];
      for (const style of styles) {
        for (const file of style.files) {
          new EntryPlugin(compiler.context, file, {
            name: isProduction ? style.name : undefined,
          }).apply(compiler);
        }
      }
      const scripts = this.pluginOptions.globalScripts ?? [];
      for (const script of scripts) {
        for (const file of script.files) {
          new EntryPlugin(compiler.context, file, {
            name: isProduction ? script.name : undefined,
          }).apply(compiler);
        }
      }
      if (this.pluginOptions.index) {
        new HtmlRspackPlugin({
          minify: false,
          inject: 'body',
          scriptLoading: 'module',
          template: this.pluginOptions.index.input,
          chunks: this.pluginOptions.index.insertionOrder.map(([name]) => name),
        }).apply(compiler);
      }
      if (
        this.pluginOptions.ssr &&
        typeof this.pluginOptions.ssr === 'object' &&
        this.pluginOptions.ssr.entry !== undefined
      ) {
        new AngularSsrDevServer(
          this.pluginOptions.outputPath as OutputPath
        ).apply(compiler);
      }
    }
    if (!isDevServer) {
      new ProgressPlugin().apply(compiler);
    }
    new DefinePlugin({
      ngDevMode: isProduction ? 'false' : {},
      ngJitMode: this.pluginOptions.aot ? undefined : 'true',
      ngServerMode: this.pluginOptions.hasServer,
    }).apply(compiler);
    if (this.pluginOptions.assets) {
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
    new RxjsEsmResolutionPlugin().apply(compiler);
    new AngularRspackPlugin(this.pluginOptions).apply(compiler);
  }
}
