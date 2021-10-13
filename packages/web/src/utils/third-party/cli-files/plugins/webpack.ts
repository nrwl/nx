/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

// Exports the webpack plugins we use internally.
export {
  ScriptsWebpackPlugin,
  ScriptsWebpackPluginOptions,
} from './scripts-webpack-plugin';
export {
  RemoveHashPlugin,
  RemoveHashPluginOptions,
} from './remove-hash-plugin';
export {
  default as PostcssCliResources,
  PostcssCliResourcesOptions,
} from './postcss-cli-resources';

import { join } from 'path';
export const RawCssLoader = require.resolve(join(__dirname, 'raw-css-loader'));
