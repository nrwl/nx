/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as CleanCSS from 'clean-css';
import { RawSourceMap } from 'source-map';

export interface CleanCssWebpackPluginOptions {
  sourceMap: boolean;
  test: (file: string) => boolean;
}

// TODO(jack): Remove this entire plugin in Nx 13 (once we deprecate webpack 4)
type Compiler = any;
type Compilation = any;
type Chunk = any;

function hook(
  compiler: Compiler,
  action: (compilation: Compilation, chunks: Chunk[]) => Promise<void | void[]>
) {
  compiler.hooks.compilation.tap(
    'cleancss-webpack-plugin',
    (compilation: Compilation) => {
      compilation.hooks.optimizeChunkAssets.tapPromise(
        'cleancss-webpack-plugin',
        (chunks) => action(compilation, chunks)
      );
    }
  );
}

export class CleanCssWebpackPlugin {
  private readonly _options: CleanCssWebpackPluginOptions;

  constructor(options: Partial<CleanCssWebpackPluginOptions>) {
    this._options = {
      sourceMap: false,
      test: (file) => file.endsWith('.css'),
      ...options,
    };
  }

  apply(compiler: Compiler): void {
    // TODO(jack): Remove this in Nx 13 and go back to proper types
    const { webpackSources, webpack } = require('../../../../webpack/entry');
    const { WebpackError } = webpack;

    hook(compiler, (compilation, chunks) => {
      // TODO(jack): Remove in Nx 13
      const { isWebpack5 } = require('../../../../webpack/entry');

      const cleancss = new CleanCSS({
        compatibility: 'ie9',
        level: {
          2: {
            skipProperties: [
              'transition', // Fixes #12408
              'font', // Fixes #9648
            ],
          },
        },
        inline: false,
        returnPromise: true,
        sourceMap: this._options.sourceMap,
      });

      const files: string[] = [...compilation.additionalChunkAssets];

      chunks.forEach((chunk) => {
        if (isWebpack5) {
          if (chunk.files && chunk.files.size > 0) {
            const xs: any = Array.from(chunk.files.values());
            files.push(...xs);
          }
        } else {
          if (chunk.files && chunk.files.length > 0) {
            files.push(...chunk.files);
          }
        }
      });

      const actions = files
        .filter((file) => this._options.test(file))
        .map(async (file) => {
          const asset = compilation.assets[file];
          if (!asset) {
            return;
          }

          let content: string | Buffer;
          let map: RawSourceMap;
          if (this._options.sourceMap && asset.sourceAndMap) {
            const sourceAndMap = asset.sourceAndMap();
            content = sourceAndMap.source;
            map = sourceAndMap.map as RawSourceMap;
          } else {
            content = asset.source();
          }

          if (content.length === 0) {
            return;
          }

          const output = await cleancss.minify(content, map);

          let hasWarnings = false;
          if (output.warnings && output.warnings.length > 0) {
            compilation.warnings.push(...output.warnings);
            hasWarnings = true;
          }

          if (output.errors && output.errors.length > 0) {
            output.errors.forEach((error: string) =>
              compilation.errors.push(new WebpackError(error))
            );

            return;
          }

          // generally means invalid syntax so bail
          if (hasWarnings && output.stats.minifiedSize === 0) {
            return;
          }

          let newSource;
          if (output.sourceMap) {
            newSource = new webpackSources.SourceMapSource(
              output.styles,
              file,
              // tslint:disable-next-line: no-any
              output.sourceMap.toString() as any,
              content as string,
              // TODO This map is not mapping as expected...
              // @ts-ignore
              map
            );
          } else {
            newSource = new webpackSources.RawSource(output.styles);
          }

          compilation.assets[file] = newSource;
        });

      return Promise.all(actions).then(() => undefined);
    });
  }
}
