/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Compiler } from 'webpack';
// Webpack doesn't export these so the deep imports can potentially break.
// There doesn't seem to exist any ergonomic way to alter chunk names for non-context lazy chunks
// (https://github.com/webpack/webpack/issues/9075) so this is the best alternative for now.
const ImportDependency = require('webpack/lib/dependencies/ImportDependency');
const ImportDependenciesBlock = require('webpack/lib/dependencies/ImportDependenciesBlock');
const Template = require('webpack/lib/Template');

export class NamedLazyChunksPlugin {
  constructor() { }
  apply(compiler: Compiler): void {
    compiler.hooks.compilation.tap('named-lazy-chunks-plugin', compilation => {
      // The dependencyReference hook isn't in the webpack typings so we have to type it as any.
      // tslint:disable-next-line: no-any
      (compilation.hooks as any).dependencyReference.tap('named-lazy-chunks-plugin',
        // tslint:disable-next-line: no-any
        (_: any, dependency: any) => {
          if (
            // Check this dependency is from an `import()` statement.
            dependency instanceof ImportDependency
            && dependency.block instanceof ImportDependenciesBlock
            // Don't rename chunks that already have a name.
            && dependency.block.chunkName === null
          ) {
            // Convert the request to a valid chunk name using the same logic used
            // in webpack/lib/ContextModule.js
            dependency.block.chunkName = Template.toPath(dependency.request);
          }
        });
    });
  }
}
