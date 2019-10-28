/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.

// Remove .js files from entry points consisting entirely of .css|scss|sass|less|styl.
// To be used together with ExtractTextPlugin.

export class SuppressExtractedTextChunksWebpackPlugin {
  constructor() { }

  apply(compiler: any): void {
    compiler.hooks.compilation.tap('SuppressExtractedTextChunks', (compilation: any) => {
      // find which chunks have css only entry points
      const cssOnlyChunks: string[] = [];
      const entryPoints = compilation.options.entry;
      // determine which entry points are composed entirely of css files
      for (let entryPoint of Object.keys(entryPoints)) {
        let entryFiles: string[] | string = entryPoints[entryPoint];
        // when type of entryFiles is not array, make it as an array
        entryFiles = entryFiles instanceof Array ? entryFiles : [entryFiles];
        if (entryFiles.every((el: string) =>
          el.match(/\.(css|scss|sass|less|styl)$/) !== null)) {
          cssOnlyChunks.push(entryPoint);
        }
      }
      // Remove the js file for supressed chunks
      compilation.hooks.afterSeal.tap('SuppressExtractedTextChunks', () => {
        compilation.chunks
          .filter((chunk: any) => cssOnlyChunks.indexOf(chunk.name) !== -1)
          .forEach((chunk: any) => {
            let newFiles: string[] = [];
            chunk.files.forEach((file: string) => {
              if (file.match(/\.js(\.map)?$/)) {
                // remove js files
                delete compilation.assets[file];
              } else {
                newFiles.push(file);
              }
            });
            chunk.files = newFiles;
          });
      });
      // Remove scripts tags with a css file as source, because HtmlWebpackPlugin will use
      // a css file as a script for chunks without js files.
      // TODO: Enable this once HtmlWebpackPlugin supports Webpack 4
      // compilation.plugin('html-webpack-plugin-alter-asset-tags',
      //   (htmlPluginData: any, callback: any) => {
      //     const filterFn = (tag: any) =>
      //       !(tag.tagName === 'script' && tag.attributes.src.match(/\.css$/));
      //     htmlPluginData.head = htmlPluginData.head.filter(filterFn);
      //     htmlPluginData.body = htmlPluginData.body.filter(filterFn);
      //     callback(null, htmlPluginData);
      //   });
    });
  }
}
