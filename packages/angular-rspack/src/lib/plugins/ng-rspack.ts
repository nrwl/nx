import {
  Compiler,
  CopyRspackPlugin,
  DefinePlugin,
  EntryPlugin,
  HtmlRspackPlugin,
  ProgressPlugin,
  RspackPluginInstance,
} from '@rspack/core';
import { basename, extname, join } from 'path';
import { RxjsEsmResolutionPlugin } from './rxjs-esm-resolution';
import { AngularRspackPlugin } from './angular-rspack-plugin';
import type { NormalizedAngularRspackPluginOptions } from '../models';
import { AngularSsrDevServer } from './angular-ssr-dev-server';

export class NgRspackPlugin implements RspackPluginInstance {
  pluginOptions: NormalizedAngularRspackPluginOptions;

  constructor(options: NormalizedAngularRspackPluginOptions) {
    this.pluginOptions = options;
  }

  apply(compiler: Compiler) {
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
      const styles = this.pluginOptions.styles ?? [];
      for (const style of styles) {
        new EntryPlugin(compiler.context, style, {
          name: isProduction ? this.getEntryName(style) : undefined,
        }).apply(compiler);
      }
      const scripts = this.pluginOptions.scripts ?? [];
      for (const script of scripts) {
        new EntryPlugin(compiler.context, script, {
          name: isProduction ? this.getEntryName(script) : undefined,
        }).apply(compiler);
      }
      new HtmlRspackPlugin({
        minify: false,
        inject: 'body',
        scriptLoading: 'module',
        template: join(this.pluginOptions.root, this.pluginOptions.index),
      }).apply(compiler);
      if (
        this.pluginOptions.ssr &&
        typeof this.pluginOptions.ssr === 'object' &&
        this.pluginOptions.ssr.entry !== undefined
      ) {
        new AngularSsrDevServer().apply(compiler);
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
        patterns: (this.pluginOptions.assets ?? []).map((assetPath) => ({
          from: join(this.pluginOptions.root, assetPath),
          to: '.',
          noErrorOnMissing: true,
        })),
      }).apply(compiler);
    }
    new RxjsEsmResolutionPlugin().apply(compiler);
    new AngularRspackPlugin(this.pluginOptions).apply(compiler);
  }

  private getEntryName(path: string) {
    return basename(path, extname(path));
  }
}
