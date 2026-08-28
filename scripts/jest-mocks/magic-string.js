// @angular-devkit/schematics@22.1 pulls magic-string@1, which is ESM-only and
// breaks Jest in CommonJS mode. The workspace's own 0.30.x still ships a
// CommonJS build, but its module object is the MagicString class itself, with
// `default` attached and no named `MagicString` export. schematics@22.1 reads
// the named one (`new magic_string_1.MagicString(...)`), while schematics@22.0
// and our own file-change-recorder read the default, so serve both.
const path = require('path');
const realMagicStringPath = require.resolve('magic-string', {
  paths: [path.join(__dirname, '../../node_modules')],
});
const MagicString = require(realMagicStringPath);

// Proxy the class itself rather than an empty target, so `new MagicString(...)`
// and the Bundle/SourceMap exports keep working without re-declaring them.
module.exports = new Proxy(MagicString, {
  get(target, prop) {
    if (prop === '__esModule') return true;
    if (prop === 'MagicString') return target.MagicString ?? MagicString;
    return target[prop];
  },
  has(target, prop) {
    return prop === '__esModule' || prop === 'MagicString' || prop in target;
  },
});
