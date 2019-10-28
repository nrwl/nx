/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as CleanCSS from 'clean-css';
import { Compiler, compilation } from 'webpack';
import { RawSource, Source, SourceMapSource } from 'webpack-sources';

export interface CleanCssWebpackPluginOptions {
  sourceMap: boolean;
  test: (file: string) => boolean;
}

function hook(
  compiler: Compiler,
  action: (
    compilation: compilation.Compilation,
    chunks: compilation.Chunk[],
  ) => Promise<void | void[]>,
) {
  compiler.hooks.compilation.tap(
    'cleancss-webpack-plugin',
    (compilation: compilation.Compilation) => {
      compilation.hooks.optimizeChunkAssets.tapPromise('cleancss-webpack-plugin', chunks =>
        action(compilation, chunks),
      );
    },
  );
}

export class CleanCssWebpackPlugin {
  private readonly _options: CleanCssWebpackPluginOptions;

  constructor(options: Partial<CleanCssWebpackPluginOptions>) {
    this._options = {
      sourceMap: false,
      test: file => file.endsWith('.css'),
      ...options,
    };
  }

  apply(compiler: Compiler): void {
    hook(compiler, (compilation: compilation.Compilation, chunks: compilation.Chunk[]) => {
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

      chunks.forEach(chunk => {
        if (chunk.files && chunk.files.length > 0) {
          files.push(...chunk.files);
        }
      });

      const actions = files
        .filter(file => this._options.test(file))
        .map(async file => {
          const asset = compilation.assets[file] as Source;
          if (!asset) {
            return;
          }

          let content: string;
          // tslint:disable-next-line: no-any
          let map: any;
          if (this._options.sourceMap && asset.sourceAndMap) {
            const sourceAndMap = asset.sourceAndMap();
            content = sourceAndMap.source;
            map = sourceAndMap.map;
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
            output.errors.forEach((error: string) => compilation.errors.push(new Error(error)));

            return;
          }

          // generally means invalid syntax so bail
          if (hasWarnings && output.stats.minifiedSize === 0) {
            return;
          }

          let newSource;
          if (output.sourceMap) {
            newSource = new SourceMapSource(
              output.styles,
              file,
              // tslint:disable-next-line: no-any
              output.sourceMap.toString() as any,
              content,
              map,
            );
          } else {
            newSource = new RawSource(output.styles);
          }

          compilation.assets[file] = newSource;
        });

      return Promise.all(actions);
    });
  }
}
