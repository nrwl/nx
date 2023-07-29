try {
  // TODO(v17): We will not need to maintain this file anymore, change this to a regular export statement
  // This file was introduced in the nx package in v15.7 but devkit is compatible down to v14.1 which doesn't have this file.
  module.exports = require('nx/src/devkit-testing-exports');
} catch {
  // These are the nx-reexports from before v16
  // TODO(v17): This can be removed once the above is done.
  module.exports = require('./testing-pre16');
}
