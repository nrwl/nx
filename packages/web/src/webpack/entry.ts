import { logger } from '@nrwl/devkit';
import { requireShim } from './require-shim';

const { version } = requireShim('webpack/package.json');

exports.default = undefined;

const forceWebpack4 = process.env.NX_FORCE_WEBPACK_4;

exports.isWebpack5 = !forceWebpack4 && /^5\./.test(version);

let hasLogged = false;

if (exports.isWebpack5) {
  if (!hasLogged) {
    logger.info(
      `NX Using webpack 5. Reason: detected version 5 in node_modules/webpack/package.json`
    );
    hasLogged = true;
  }
  Object.assign(
    exports,
    require('./bundle5')(() => {
      exports.isWebpack5 = false;
    })
  );
} else {
  if (!hasLogged) {
    hasLogged = true;
  }
  Object.assign(exports, require('./bundle4')());
}
