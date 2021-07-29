import { requireShim } from './require-shim';

const result = requireShim('webpack/package.json');
const version = result?.version;

exports.default = undefined;

const forceWebpack4 = process.env.NX_FORCE_WEBPACK_4;

exports.isWebpack5 = !forceWebpack4 && /^5\./.test(version);

if (exports.isWebpack5) {
  Object.assign(
    exports,
    require('./bundle5')(() => {
      exports.isWebpack5 = false;
    })
  );
} else {
  Object.assign(exports, require('./bundle4')());
}
