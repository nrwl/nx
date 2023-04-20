/**
 * The Nx Devkit is the underlying technology used to customize Nx to support
 * different technologies and custom use-cases. It contains many utility
 * functions for reading and writing files, updating configuration,
 * working with Abstract Syntax Trees(ASTs), and more.
 *
 * As with most things in Nx, the core of Nx Devkit is very simple.
 * It only uses language primitives and immutable objects
 * (the tree being the only exception).
 *
 * @module @nrwl/devkit
 */

try {
  // TODO(v17): We will not need to maintain this file anymore, change this to a regular export statement
  // This file was introduced in the nx package in v15.7 but devkit is compatible down to v14.1 which doesn't have this file.
  module.exports = require('nx/src/devkit-exports');
} catch {
  // These are the nx-reexports from before v16
  // TODO(v17): This can be removed once the above is done.
  module.exports = require('./nx-reexports-pre16');
}

module.exports = {
  ...module.exports,
  ...require('./public-api'),
};
