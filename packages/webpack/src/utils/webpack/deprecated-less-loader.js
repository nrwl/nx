const lessLoader = require('less-loader');

module.exports = function (...args) {
  if (!process.env.__NX_LESS_DEPRECATION_WARNED) {
    process.env.__NX_LESS_DEPRECATION_WARNED = '1';
    console.warn(
      '\n⚠️  Less support in Nx is deprecated and will be removed in a future version.\n' +
        '   Please migrate to CSS or SCSS.\n' +
        '   Existing .less imports continue to compile, but Nx generators no longer\n' +
        '   accept --style=less. To add new Less files, install less-loader manually\n' +
        '   and generate with --style=css, then rename the file to .less.\n'
    );
  }
  return lessLoader.apply(this, args);
};

if (lessLoader.raw) {
  module.exports.raw = lessLoader.raw;
}
